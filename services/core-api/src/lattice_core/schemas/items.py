from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from lattice_core.domain.enums import (
    CardTracking,
    CardType,
    FieldMode,
    FieldType,
    ItemState,
    ItemType,
    StorageStatus,
)
from lattice_core.schemas.common import (
    CatalogRef,
    ItemRef,
    LocationRef,
    Schema,
    TemplateRef,
    UserRef,
)
from lattice_core.schemas.documents import DocumentOut
from lattice_core.schemas.locations import LocationOut

# ─────────────────────────── commands ───────────────────────────


class ItemCreate(BaseModel):
    template_id: int
    values: dict[str, Any] = Field(
        default_factory=dict, description="{field key: value} for per-item and list fields"
    )
    serial: str | None = Field(default=None, description="Empty → the next serial")
    child_ids: list[int] = Field(default_factory=list, description="Items to place inside")


class ItemUpdate(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict, description="Only the changed fields")
    serial: str | None = None


class MoveCommand(BaseModel):
    location_id: int
    note: str | None = None


class LinkCommand(BaseModel):
    parent_id: int


class UnlinkCommand(BaseModel):
    location_id: int | None = Field(
        default=None, description="Where it now is; defaults to the container's location"
    )


class StateCommand(BaseModel):
    state: ItemState
    note: str | None = None


class ContentsCommand(BaseModel):
    child_ids: list[int] = Field(default_factory=list, description="The contents after the edit")


class DeleteCommand(BaseModel):
    pass


class BulkAction(StrEnum):
    MOVE = "move"
    STATE_CHANGE = "state_change"
    DELETE = "delete"
    LINK = "link"
    UNLINK = "unlink"


class BulkCommand(BaseModel):
    action: BulkAction
    item_ids: list[int] = Field(min_length=1)
    location_id: int | None = None
    parent_id: int | None = None
    state: ItemState | None = None
    note: str | None = None


class BulkResult(BaseModel):
    processed: int


class ExtraIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    company_part_number: str | None = None
    serial: str | None = None
    signed_by: str | None = None


class ExtraOut(ExtraIn, Schema):
    id: int


class LinkDocumentCommand(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    url: str = Field(min_length=1, max_length=1024)
    doc_type: str | None = None


# ─────────────────────────── views ───────────────────────────


class ItemRow(Schema):
    """An item as a row of a list."""

    id: int
    type: ItemType
    template: TemplateRef
    name: str
    serial: str
    state: ItemState
    card_type: CardType | None = None
    quantity: int = 1
    storage: StorageStatus | None = None
    parent: ItemRef | None = None
    location: LocationRef | None = None
    industry: CatalogRef | None = None
    project: CatalogRef | None = None
    team: CatalogRef | None = None
    managers: list[UserRef] = Field(default_factory=list)
    children_count: int = 0
    missing_children: int = 0
    updated_at: datetime


class ItemFieldOut(BaseModel):
    field_id: int
    key: str
    label: str
    field_type: FieldType
    mode: FieldMode
    required: bool
    config: dict[str, Any] = Field(default_factory=dict)
    value: Any = None
    display: Any = None
    missing: bool = False


class StateEntry(Schema):
    id: int
    state: ItemState
    note: str | None = None
    changed_by_name: str | None = None
    changed_at: datetime


class CompositionRow(BaseModel):
    template: TemplateRef
    min_count: int = 0
    max_count: int | None = None
    count: int = 0
    missing: int = 0
    is_full: bool = False


class ItemDetail(ItemRow):
    tracking: CardTracking | None = None
    location_detail: LocationOut | None = None
    ancestors: list[ItemRef] = Field(default_factory=list, description="Nearest first")
    children: list[ItemRef] = Field(default_factory=list)
    responsible: UserRef | None = None
    fields: list[ItemFieldOut] = Field(default_factory=list)
    state_history: list[StateEntry] = Field(default_factory=list)
    documents: list[DocumentOut] = Field(default_factory=list)
    extras: list[ExtraOut] = Field(default_factory=list)
    composition: list[CompositionRow] = Field(default_factory=list)
    is_complete: bool = True
    allowed_parent_templates: list[TemplateRef] = Field(default_factory=list)
    created_at: datetime
