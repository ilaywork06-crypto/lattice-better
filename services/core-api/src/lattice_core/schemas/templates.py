from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from lattice_core.domain.enums import CardTracking, CardType, FieldMode, FieldType, ItemType
from lattice_core.schemas.common import Schema, TemplateRef
from lattice_core.schemas.documents import DocumentOut


class FieldIn(BaseModel):
    """A field definition as written in the template editor (or a field group)."""

    id: int | None = Field(default=None, description="An existing field of this template")
    key: str | None = None
    label: str = Field(min_length=1, max_length=255)
    field_type: FieldType
    mode: FieldMode = FieldMode.ITEM
    required: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
    fixed_value: Any = None
    copy_files_from: int | None = Field(
        default=None,
        description="Creating a duplicate: copy the files of this fixed files field",
    )


class FieldOut(Schema):
    id: int
    key: str
    label: str
    field_type: FieldType
    mode: FieldMode
    required: bool
    position: int
    config: dict[str, Any]
    fixed_value: Any = None
    # Readable forms of stored ids.
    fixed_display: Any = None
    options_display: list[str] = Field(default_factory=list)
    files: list[DocumentOut] = Field(default_factory=list)


class ChildSlotIn(BaseModel):
    """One template allowed inside a container, and how many units of it."""

    template_id: int
    min_count: int = Field(default=0, ge=0)
    max_count: int | None = Field(default=None, ge=1, description="None = no limit")


class ChildSlotOut(BaseModel):
    template: TemplateRef
    min_count: int = 0
    max_count: int | None = None


class TemplateCreate(BaseModel):
    type: ItemType
    name: str = Field(min_length=1, max_length=255)
    card_type: CardType | None = None
    serial_prefix: str = Field(min_length=3, max_length=3)
    description: str | None = None
    fields: list[FieldIn] = Field(default_factory=list)
    children: list[ChildSlotIn] = Field(default_factory=list)
    source_template_id: int | None = Field(
        default=None, description="Set when this template duplicates another"
    )


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    card_type: CardType | None = None
    serial_prefix: str | None = Field(default=None, min_length=3, max_length=3)
    description: str | None = None
    fields: list[FieldIn] | None = Field(
        default=None, description="The complete field list after the edit"
    )
    children: list[ChildSlotIn] | None = Field(
        default=None, description="The complete contents list after the edit"
    )


class StateCountsOut(BaseModel):
    built: int = 0
    ok: int = 0
    faulty: int = 0
    destroyed: int = 0
    total: int = 0


class TemplateSummary(TemplateRef):
    tracking: CardTracking | None = None
    description: str | None = None
    counts: StateCountsOut = Field(default_factory=StateCountsOut)
    field_count: int = 0
    child_template_ids: list[int] = Field(default_factory=list)
    parent_template_ids: list[int] = Field(default_factory=list)
    updated_at: datetime | None = None


class TemplateDetail(TemplateSummary):
    fields: list[FieldOut] = Field(default_factory=list)
    children: list[ChildSlotOut] = Field(default_factory=list)
    parents: list[TemplateRef] = Field(default_factory=list)
    next_serial: str
    created_at: datetime


class FieldGroupFieldOut(Schema):
    key: str
    label: str
    field_type: FieldType
    mode: FieldMode
    required: bool
    position: int
    config: dict[str, Any]
    fixed_value: Any = None
    fixed_display: Any = None
    options_display: list[str] = Field(default_factory=list)


class FieldGroupOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    fields: list[FieldGroupFieldOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class FieldGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    fields: list[FieldIn] = Field(min_length=1)


class FieldGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    fields: list[FieldIn] | None = None
