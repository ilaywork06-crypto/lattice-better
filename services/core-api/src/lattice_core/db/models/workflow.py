from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lattice_core.db.base import Base, enum_column, utcnow
from lattice_core.db.models.user import User
from lattice_core.domain.enums import ChangeAction, ChangeStatus, ItemType


class ChangeRequest(Base):
    """A proposed change, applied only once a manager approves it."""

    __tablename__ = "change_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[ChangeAction] = mapped_column(enum_column(ChangeAction, "change_action"))
    item_id: Mapped[int | None] = mapped_column(
        ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("item_templates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    item_type: Mapped[ItemType | None] = mapped_column(
        enum_column(ItemType, "item_type"), nullable=True
    )
    # What the target was called when proposed — survives its deletion.
    target_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    description: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[ChangeStatus] = mapped_column(
        enum_column(ChangeStatus, "change_status"), default=ChangeStatus.PENDING, index=True
    )
    # RESTRICT: a proposal keeps its author for the audit trail.
    proposed_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    proposer: Mapped[User] = relationship(foreign_keys=[proposed_by])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewed_by])
