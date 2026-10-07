from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lattice_core.db.base import Base, utcnow

if TYPE_CHECKING:
    from lattice_core.db.models.item import Item


class Document(Base):
    """A file or a link, attached to an item or a template.

    * Uploaded bytes live in file storage under a random ``storage_key`` and are
      served back through the API only.
    * ``field_id`` ties a document to a *files* template field; without one it is
      a general document of its item.
    * A document with neither item nor template is a **staged** upload (made
      before the item it belongs to exists); stale ones are swept.
    """

    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint("url IS NOT NULL OR storage_key IS NOT NULL", name="has_content"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int | None] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=True, index=True
    )
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("item_templates.id", ondelete="CASCADE"), nullable=True, index=True
    )
    field_id: Mapped[int | None] = mapped_column(
        ForeignKey("template_fields.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    doc_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    item: Mapped[Item | None] = relationship(back_populates="documents")

    @property
    def is_file(self) -> bool:
        return self.storage_key is not None

    @property
    def is_staged(self) -> bool:
        return self.item_id is None and self.template_id is None
