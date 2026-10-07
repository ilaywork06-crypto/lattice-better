from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import ClassVar

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from lattice_core.db.base import Base
from lattice_core.domain.errors import NotFound


def like_pattern(term: str) -> str:
    """A LIKE pattern matching ``term`` literally (``%`` and ``_`` escaped)."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


class Repository[M: Base]:
    model: ClassVar[type]
    label: ClassVar[str] = "Record"

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, ident: int | None) -> M | None:
        return self.session.get(self.model, ident) if ident is not None else None

    def require(self, ident: int | None) -> M:
        obj = self.get(ident)
        if obj is None:
            raise NotFound(self.label, ident)
        return obj

    def get_many(self, ids: Iterable[int]) -> list[M]:
        ids = list(dict.fromkeys(ids))
        if not ids:
            return []
        rows = self.session.scalars(select(self.model).where(self.model.id.in_(ids))).all()
        by_id = {r.id: r for r in rows}
        return [by_id[i] for i in ids if i in by_id]

    def add(self, obj: M) -> M:
        self.session.add(obj)
        return obj

    def delete(self, obj: M) -> None:
        self.session.delete(obj)

    def flush(self) -> None:
        self.session.flush()

    def all(self, stmt: Select) -> Sequence[M]:
        return self.session.scalars(stmt).all()

    def count(self, stmt: Select) -> int:
        return self.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
