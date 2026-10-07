"""Bring the schema to the latest migration and make sure someone can sign in.

The system ships **empty**: the only row created is the bootstrap administrator.
"""

from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from lattice_core.db.models import User
from lattice_core.domain.enums import UserRole
from lattice_core.infra.security import hash_password
from lattice_core.settings import Settings

logger = logging.getLogger("lattice_core.bootstrap")
MIGRATIONS = Path(__file__).parent / "db" / "migrations"


def alembic_config(url: str | None = None) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS))
    if url:
        cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def migrate(engine: Engine) -> None:
    with engine.begin() as connection:
        cfg = alembic_config()
        cfg.attributes["connection"] = connection
        command.upgrade(cfg, "head")


def ensure_admin(session: Session, settings: Settings) -> None:
    if session.query(User).filter(User.role == UserRole.MANAGER).first() is not None:
        return
    if session.query(User).filter(User.email == settings.bootstrap_admin_email).first():
        return
    session.add(User(
        email=settings.bootstrap_admin_email,
        full_name="System Administrator",
        hashed_password=hash_password(settings.bootstrap_admin_password),
        role=UserRole.MANAGER,
    ))
    session.commit()
    logger.info("Created the bootstrap administrator %s", settings.bootstrap_admin_email)


def bootstrap(engine: Engine, session_factory: sessionmaker, settings: Settings) -> None:
    migrate(engine)
    with session_factory() as session:
        ensure_admin(session, settings)
