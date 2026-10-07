"""Test fixtures.

The product ships **empty**, so the small world the tests read — users,
catalog values, locations and the desiccator, a few templates — is built here,
through the service layer, once. Every test then gets its own copy of that
database (a file copy is far faster than rebuilding), its own upload directory
and an in-memory event publisher it can assert on.
"""

from __future__ import annotations

import itertools
import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from lattice_core.bootstrap import bootstrap
from lattice_core.db.models import User
from lattice_core.db.session import make_engine, make_session_factory
from lattice_core.domain.enums import (
    CardType,
    CatalogCategory,
    FieldMode,
    FieldType,
    ItemType,
    UserRole,
)
from lattice_core.infra.events import InMemoryPublisher
from lattice_core.infra.storage import LocalFileStorage
from lattice_core.main import create_app
from lattice_core.schemas.catalog import CatalogOptionCreate
from lattice_core.schemas.locations import BuildingIn, LocationCreate
from lattice_core.schemas.templates import ChildSlotIn, FieldIn, TemplateCreate
from lattice_core.schemas.users import UserCreate
from lattice_core.services.base import Services
from lattice_core.services.uow import UnitOfWork
from lattice_core.settings import Settings

PASSWORD = "password"
API = "/api/v1"

_WORK = Path(tempfile.mkdtemp(prefix="lattice-tests-"))
_TEMPLATE_DB = _WORK / "template.sqlite3"
# Set to a PostgreSQL server URL (e.g. postgresql+psycopg://user@host:5432/postgres) to run
# the suite on PostgreSQL: the world is built once into a template database and every
# test gets a fresh database cloned from it.
_PG = os.environ.get("LATTICE_TEST_POSTGRES_URL")
_PG_WORLD = "lattice_test_world"
_counter = itertools.count()


def field(label: str, field_type: FieldType, mode: FieldMode = FieldMode.ITEM,
          required: bool = False, **extra) -> dict:
    return {"label": label, "field_type": field_type.value, "mode": mode.value,
            "required": required, **extra}


def _settings(db: Path | str, uploads: Path) -> Settings:
    url = db if isinstance(db, str) else f"sqlite:///{db}"
    return Settings(database_url=url, redis_url="", upload_dir=str(uploads),
                    jwt_secret="test-secret-test-secret-test-secret")


def _pg_admin(statement: str) -> None:
    from sqlalchemy import create_engine, text

    engine = create_engine(_PG, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        conn.execute(text(statement))
    engine.dispose()


def _pg_url(database: str) -> str:
    return _PG.rsplit("/", 1)[0] + "/" + database


def _build_world() -> None:
    if _PG:
        _pg_admin(f"DROP DATABASE IF EXISTS {_PG_WORLD} WITH (FORCE)")
        _pg_admin(f"CREATE DATABASE {_PG_WORLD}")
    settings = _settings(_pg_url(_PG_WORLD) if _PG else _TEMPLATE_DB, _WORK / "uploads-template")
    engine = make_engine(settings.database_url)
    sessions = make_session_factory(engine)
    bootstrap(engine, sessions, settings)
    with sessions() as session:
        uow = UnitOfWork(session, InMemoryPublisher(), LocalFileStorage(settings.upload_dir))
        admin = session.query(User).filter(User.role == UserRole.MANAGER).one()
        s = Services(uow, settings, admin)

        for email, name, role in (
            ("noa@lattice.io", "Noa Manager", UserRole.MANAGER),
            ("dana@lattice.io", "Dana Editor", UserRole.EDITOR),
            ("amir@lattice.io", "Amir Viewer", UserRole.VIEWER),
        ):
            s.users.create(UserCreate(email=email, full_name=name, password=PASSWORD, role=role))

        for category, values in (
            (CatalogCategory.PROJECT, ["Falcon", "Sparrow"]),
            (CatalogCategory.INDUSTRY, ["Avionics", "Space"]),
            (CatalogCategory.TEAM, ["HW-Team-A", "Integration"]),
        ):
            for i, v in enumerate(values):
                s.catalog.create(CatalogOptionCreate(category=category, value=v, sort_order=i))

        for name, x, y, desiccator in (
            ("Lab A", 20, 30, False),
            ("Lab B", 50, 30, False),
            ("Desiccator A", 30, 70, True),
            ("Desiccator B", 35, 70, True),
            ("Storage", 80, 80, False),
        ):
            s.locations.create(LocationCreate(name=name, x=x, y=y, is_desiccator=desiccator))
        s.locations.create_building(BuildingIn(name="Building 1", x=5, y=5, width=50, height=40))

        noa = s.uow.users.by_email("noa@lattice.io")
        falcon = s.uow.catalog.find(CatalogCategory.PROJECT, "Falcon")
        sparrow = s.uow.catalog.find(CatalogCategory.PROJECT, "Sparrow")

        prb = s.templates.create(TemplateCreate(
            type=ItemType.CARD, name="Power Regulator Board", card_type=CardType.HOUSE,
            serial_prefix="PRB",
            fields=[
                FieldIn(**field("Project", FieldType.PROJECT, FieldMode.CHOICE,
                                config={"options": [falcon.id, sparrow.id]})),
                FieldIn(**field("Managers", FieldType.MANAGERS, FieldMode.FIXED,
                                fixed_value=[noa.id])),
                FieldIn(**field("Revision", FieldType.STRING, config={"pattern": "RV-##"})),
                FieldIn(**field("Location", FieldType.LOCATION)),
            ],
        ))
        res = s.templates.create(TemplateCreate(
            type=ItemType.CARD, name="Resistor Pack", card_type=CardType.COMMERCIAL,
            serial_prefix="RES",
            fields=[FieldIn(**field("Quantity", FieldType.QUANTITY, required=True))],
        ))
        spm = s.templates.create(TemplateCreate(
            type=ItemType.ASSEMBLY, name="Signal Processing Module", serial_prefix="SPM",
            fields=[FieldIn(**field("Location", FieldType.LOCATION))],
            children=[ChildSlotIn(template_id=prb.id, min_count=1, max_count=2),
                      ChildSlotIn(template_id=res.id)],
        ))
        s.templates.create(TemplateCreate(
            type=ItemType.SETUP, name="Flight Rig", serial_prefix="FRG",
            fields=[FieldIn(**field("Location", FieldType.LOCATION)),
                    FieldIn(**field("Owner", FieldType.RESPONSIBLE))],
            children=[ChildSlotIn(template_id=spm.id), ChildSlotIn(template_id=prb.id)],
        ))
    engine.dispose()


_build_world()


@dataclass
class World:
    client: TestClient
    events: InMemoryPublisher
    tokens: dict[str, str]

    def as_(self, who: str) -> Api:
        return Api(self.client, self.tokens[who])

    @property
    def admin(self) -> Api:
        return self.as_("admin")


class Api:
    """A tiny client bound to one signed-in user, speaking /api/v1."""

    def __init__(self, client: TestClient, token: str) -> None:
        self.client = client
        self.headers = {"Authorization": f"Bearer {token}"}

    def _do(self, method: str, path: str, **kw):
        return self.client.request(method, API + path, headers=self.headers, **kw)

    def get(self, path, **kw):
        return self._do("GET", path, **kw)

    def post(self, path, **kw):
        return self._do("POST", path, **kw)

    def patch(self, path, **kw):
        return self._do("PATCH", path, **kw)

    def put(self, path, **kw):
        return self._do("PUT", path, **kw)

    def delete(self, path, **kw):
        return self._do("DELETE", path, **kw)

    # ── conveniences ──
    def ok(self, method: str, path: str, status: int | None = None, **kw):
        r = self._do(method, path, **kw)
        expected = status or (201 if method == "POST" and r.status_code == 201 else 200)
        assert r.status_code == expected, f"{method} {path} → {r.status_code}: {r.text}"
        return r.json() if r.content else None

    def template(self, name: str) -> dict:
        return next(t for t in self.ok("GET", "/templates") if t["name"] == name)

    def location(self, name: str) -> dict:
        return next(loc for loc in self.ok("GET", "/locations") if loc["name"] == name)

    def user(self, email: str) -> dict:
        return next(u for u in self.ok("GET", "/users") if u["email"] == email)

    def catalog(self, value: str) -> dict:
        return next(o for o in self.ok("GET", "/catalog") if o["value"] == value)

    def create_item(self, template: str, status: int = 201, **body) -> dict:
        tpl = self.template(template)
        r = self.post("/items", json={"template_id": tpl["id"], **body})
        assert r.status_code == status, r.text
        return r.json()


@pytest.fixture
def world(tmp_path: Path):
    if _PG:
        name = f"lattice_test_{os.getpid()}_{next(_counter)}"
        _pg_admin(f"CREATE DATABASE {name} TEMPLATE {_PG_WORLD}")
        db: Path | str = _pg_url(name)
    else:
        db = tmp_path / "lattice.sqlite3"
        shutil.copyfile(_TEMPLATE_DB, db)
    events = InMemoryPublisher()
    app = create_app(_settings(db, tmp_path / "uploads"), publisher=events)
    with TestClient(app) as client:
        tokens = {}
        with app.state.session_factory() as session:
            services = Services(UnitOfWork(session, events, app.state.storage), app.state.settings)
            for who, email in (("admin", "admin@lattice.io"), ("manager", "noa@lattice.io"),
                               ("editor", "dana@lattice.io"), ("viewer", "amir@lattice.io")):
                user = services.uow.users.by_email(email)
                tokens[who] = services.auth.issue_token(user)
        yield World(client, events, tokens)
    if _PG:
        app.state.engine.dispose()
        _pg_admin(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)")


@pytest.fixture
def admin(world: World) -> Api:
    return world.admin
