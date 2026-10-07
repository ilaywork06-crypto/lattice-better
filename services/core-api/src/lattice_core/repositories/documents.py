from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from lattice_core.db.models import Document
from lattice_core.repositories.base import Repository


class DocumentRepository(Repository[Document]):
    model = Document
    label = "Document"

    def of_template(self, template_id: int) -> list[Document]:
        return list(
            self.all(
                select(Document)
                .where(Document.template_id == template_id)
                .order_by(Document.created_at, Document.id)
            )
        )

    def of_field(self, field_id: int, *, item_id: int | None = None,
                 template_id: int | None = None) -> list[Document]:
        stmt = select(Document).where(Document.field_id == field_id)
        if item_id is not None:
            stmt = stmt.where(Document.item_id == item_id)
        if template_id is not None:
            stmt = stmt.where(Document.template_id == template_id)
        return list(self.all(stmt.order_by(Document.created_at, Document.id)))

    def stale_staged(self, before: datetime) -> list[Document]:
        return list(
            self.all(
                select(Document).where(
                    Document.item_id.is_(None),
                    Document.template_id.is_(None),
                    Document.created_at < before,
                )
            )
        )
