from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from lattice_core.domain.enums import ChangeAction, ChangeStatus, ItemType
from lattice_core.schemas.common import Schema, UserRef


class ChangeRequestCreate(BaseModel):
    action: ChangeAction
    item_id: int | None = None
    template_id: int | None = None
    payload: dict[str, Any] = Field(
        default_factory=dict, description="The command the change applies — see API.md"
    )
    reason: str = Field(min_length=1, description="Why the change is needed")


class ChangeRequestOut(Schema):
    id: int
    action: ChangeAction
    item_id: int | None = None
    template_id: int | None = None
    item_type: ItemType | None = None
    target_name: str | None = None
    payload: dict[str, Any]
    description: str
    reason: str
    status: ChangeStatus
    proposer: UserRef
    reviewer: UserRef | None = None
    review_note: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class AuditOut(Schema):
    id: int
    item_id: int | None = None
    template_id: int | None = None
    subject: str | None = None
    action: str
    summary: str
    details: dict[str, Any]
    user_id: int | None = None
    user_name: str | None = None
    created_at: datetime
