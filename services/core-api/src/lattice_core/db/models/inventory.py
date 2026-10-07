from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lattice_core.db.base import Base
from lattice_core.db.models.template import ItemTemplate


class StockThreshold(Base):
    """The minimum *available* stock of one card template (see services/inventory.py)."""

    __tablename__ = "stock_thresholds"

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("item_templates.id", ondelete="CASCADE"), unique=True, index=True
    )
    min_quantity: Mapped[int] = mapped_column(Integer, default=0)
    # An extra recipient (besides the template's managers) for low-stock alerts.
    notify_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    template: Mapped[ItemTemplate] = relationship()
