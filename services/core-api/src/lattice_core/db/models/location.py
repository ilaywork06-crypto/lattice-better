from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.expression import false

from lattice_core.db.base import Base, utcnow


class Location(Base):
    """A physical place; also a marker on the 100 × 100 floor plan."""

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    building: Mapped[str | None] = mapped_column(String(255), nullable=True)
    room: Mapped[str | None] = mapped_column(String(255), nullable=True)
    x: Mapped[float] = mapped_column(default=50.0)
    y: Mapped[float] = mapped_column(default=50.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Part of the desiccator: cards here are stock available for building.
    is_desiccator: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), index=True
    )


class MapBuilding(Base):
    """A building/zone drawn behind the location markers (0..100 coordinates)."""

    __tablename__ = "map_buildings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    x: Mapped[float] = mapped_column(default=5.0)
    y: Mapped[float] = mapped_column(default=5.0)
    width: Mapped[float] = mapped_column(default=30.0)
    height: Mapped[float] = mapped_column(default=20.0)
    color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
