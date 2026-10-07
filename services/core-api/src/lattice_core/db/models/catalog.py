from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from lattice_core.db.base import Base, enum_column, utcnow
from lattice_core.domain.enums import CatalogCategory


class CatalogOption(Base):
    """An allowed value for projects / industries / teams.

    Items reference values by id, so a rename is one row and a value in use
    cannot be deleted from under the items holding it.
    """

    __tablename__ = "catalog_options"
    __table_args__ = (UniqueConstraint("category", "value", name="uq_catalog_category_value"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[CatalogCategory] = mapped_column(
        enum_column(CatalogCategory, "catalog_category"), index=True
    )
    value: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CatalogLink(Base):
    """A two-way link between two values of different categories.

    Stored once, smaller id first, so "the projects of team T" and "the teams of
    project P" are the same lookup and a pair can't be recorded twice.
    """

    __tablename__ = "catalog_links"
    __table_args__ = (CheckConstraint("option_a_id < option_b_id", name="ordered_pair"),)

    option_a_id: Mapped[int] = mapped_column(
        ForeignKey("catalog_options.id", ondelete="CASCADE"), primary_key=True
    )
    option_b_id: Mapped[int] = mapped_column(
        ForeignKey("catalog_options.id", ondelete="CASCADE"), primary_key=True, index=True
    )
