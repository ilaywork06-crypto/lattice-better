"""Documents: uploaded files and links, on items and templates.

Bytes go to file storage under a random key; the row records the original
name and type. Deleting a document removes its file only after the
transaction commits, and a file written by a transaction that rolls back is
removed again (see ``UnitOfWork``).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import BinaryIO

from lattice_core.db.models import Document, Item, TemplateField
from lattice_core.domain.enums import FieldMode, FieldType
from lattice_core.domain.errors import NotFound, RuleViolation
from lattice_core.domain.permissions import Permission
from lattice_core.schemas.items import LinkDocumentCommand
from lattice_core.services.base import Service


@dataclass(slots=True)
class IncomingFile:
    """An upload, independent of the web framework that received it."""

    filename: str
    content_type: str | None
    stream: BinaryIO


@dataclass(slots=True)
class Download:
    path: Path
    content_type: str
    filename: str


class DocumentService(Service):
    # ── storing ──
    def _store(self, file: IncomingFile, *, name: str | None = None, doc_type: str | None = None,
               item_id: int | None = None, template_id: int | None = None,
               field_id: int | None = None) -> Document:
        original = Path(file.filename or "file").name[:255] or "file"
        key, size = self.uow.storage.save(
            file.stream,
            suffix=Path(original).suffix,
            max_bytes=self.settings.max_upload_mb * 1024 * 1024,
            name=original,
        )
        self.uow.file_written(key)
        doc = Document(
            item_id=item_id,
            template_id=template_id,
            field_id=field_id,
            name=(name or "").strip() or original,
            doc_type=(doc_type or "").strip() or None,
            storage_key=key,
            original_filename=original,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=size,
            uploaded_by=self.actor.id,
        )
        self.uow.documents.add(doc)
        self.uow.session.flush()
        return doc

    def stage(self, file: IncomingFile, name: str | None = None) -> Document:
        """Upload a file before the item it belongs to exists (a form, a proposal)."""
        self.services.require(Permission.STAGE_UPLOADS)
        with self.uow.transaction():
            self.sweep_staged()
            return self._store(file, name=name)

    def sweep_staged(self) -> int:
        cutoff = datetime.now(UTC) - timedelta(days=self.settings.staged_upload_ttl_days)
        stale = self.uow.documents.stale_staged(cutoff)
        for doc in stale:
            self.delete(doc)
        return len(stale)

    # ── item documents ──
    def upload_to_item(self, item_id: int, file: IncomingFile, *, name: str | None,
                       doc_type: str | None) -> Document:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            self.uow.items.require(item_id)
            return self._store(file, name=name, doc_type=doc_type, item_id=item_id)

    def link_to_item(self, item_id: int, cmd: LinkDocumentCommand) -> Document:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            self.uow.items.require(item_id)
            doc = Document(
                item_id=item_id,
                name=cmd.name.strip(),
                url=cmd.url.strip(),
                doc_type=(cmd.doc_type or "").strip() or None,
                uploaded_by=self.actor.id,
            )
            self.uow.documents.add(doc)
            self.uow.session.flush()
            return doc

    def remove_from_item(self, item_id: int, doc_id: int) -> None:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            doc = self.uow.documents.get(doc_id)
            if doc is None or doc.item_id != item_id:
                raise NotFound("Document", doc_id)
            self.delete(doc)

    # ── template files (a fixed files field, shared by every item) ──
    def upload_to_template(self, template_id: int, field_id: int, file: IncomingFile,
                           name: str | None = None) -> Document:
        self.services.require(Permission.WRITE_TEMPLATES)
        with self.uow.transaction():
            tpl = self.uow.templates.require(template_id)
            field = self.uow.template_fields.get(field_id)
            if field is None or field.template_id != tpl.id:
                raise NotFound("Field", field_id)
            if field.field_type != FieldType.FILES or field.mode != FieldMode.FIXED:
                raise RuleViolation("Only a files field set on the template holds template files")
            return self._store(file, name=name, template_id=tpl.id, field_id=field.id)

    def remove_from_template(self, template_id: int, doc_id: int) -> None:
        self.services.require(Permission.WRITE_TEMPLATES)
        with self.uow.transaction():
            doc = self.uow.documents.get(doc_id)
            if doc is None or doc.template_id != template_id:
                raise NotFound("File", doc_id)
            self.delete(doc)

    def copy_field_files(self, source_field_id: int, target: TemplateField) -> int:
        """Duplicating a template: give the new fixed files field its own copies."""
        source = self.uow.template_fields.get(source_field_id)
        if source is None or source.field_type != FieldType.FILES:
            raise RuleViolation(f"'{target.label}': the field to copy files from no longer exists")
        docs = self.uow.documents.of_field(source.id, template_id=source.template_id)
        for doc in docs:
            key = None
            if doc.storage_key:
                if not self.uow.storage.exists(doc.storage_key):
                    raise RuleViolation(f"The file of '{doc.name}' is missing from storage")
                key = self.uow.storage.copy(doc.storage_key)
                self.uow.file_written(key)
            self.uow.documents.add(Document(
                template_id=target.template_id,
                field_id=target.id,
                name=doc.name,
                doc_type=doc.doc_type,
                url=doc.url,
                storage_key=key,
                original_filename=doc.original_filename,
                content_type=doc.content_type,
                size_bytes=doc.size_bytes,
                uploaded_by=self.actor.id,
            ))
        return len(docs)

    # ── files fields on items ──
    def sync_item_field(self, item: Item, field: TemplateField, doc_ids: list[int]) -> None:
        """Make an item's per-item files field hold exactly ``doc_ids``.

        New ids must be staged uploads; ones no longer listed are deleted.
        """
        current = {d.id: d for d in self.uow.documents.of_field(field.id, item_id=item.id)}
        for doc_id in doc_ids:
            if doc_id in current:
                continue
            doc = self.uow.documents.get(doc_id)
            if doc is None:
                raise RuleViolation(f"Uploaded file #{doc_id} no longer exists")
            if not doc.is_staged:
                raise RuleViolation(f"File '{doc.name}' already belongs to another record")
            doc.item_id = item.id
            doc.field_id = field.id
        for doc_id, doc in current.items():
            if doc_id not in doc_ids:
                self.delete(doc)

    # ── common ──
    def delete(self, doc: Document) -> None:
        if doc.storage_key:
            self.uow.delete_file_on_commit(doc.storage_key)
        self.uow.documents.delete(doc)

    def download(self, doc_id: int) -> Download:
        self.services.require(Permission.READ)
        doc = self.uow.documents.require(doc_id)
        if not doc.is_file:
            raise RuleViolation("This document is a link, not a file")
        if not self.uow.storage.exists(doc.storage_key):
            raise NotFound("Stored file")
        return Download(
            path=self.uow.storage.path(doc.storage_key),
            content_type=doc.content_type or "application/octet-stream",
            filename=doc.original_filename or doc.name,
        )
