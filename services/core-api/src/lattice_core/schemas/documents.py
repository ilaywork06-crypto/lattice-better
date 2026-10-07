from __future__ import annotations

from datetime import datetime

from lattice_core.schemas.common import Schema


class DocumentOut(Schema):
    id: int
    name: str
    doc_type: str | None = None
    url: str | None = None
    is_file: bool = False
    original_filename: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    field_id: int | None = None
    created_at: datetime
