"""The event contract between services.

The core API *publishes* domain events on one Redis pub/sub channel; the
notification service *subscribes* and turns each event into in-app
notifications and emails. Both sides import these models, so the wire format
is defined exactly once.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field

CHANNEL = "lattice:events"


class EventType(StrEnum):
    CHANGE_REQUEST_SUBMITTED = "change_request.submitted"
    CHANGE_REQUEST_APPROVED = "change_request.approved"
    CHANGE_REQUEST_REJECTED = "change_request.rejected"
    LOW_STOCK = "inventory.low_stock"


class Recipient(BaseModel):
    """Who receives the notification an event produces.

    A recipient with a ``user_id`` gets an in-app notification; one with an
    ``email`` gets an email. Either or both may be set.
    """

    user_id: int | None = None
    email: str | None = None


class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: EventType
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    title: str
    body: str
    # Frontend route the notification points at, e.g. "/change-requests/12".
    link: str | None = None
    recipients: list[Recipient] = Field(default_factory=list)
    # Structured context for the UI (ids, the low-stock component table, …).
    payload: dict = Field(default_factory=dict)

    def to_wire(self) -> str:
        return self.model_dump_json()

    @classmethod
    def from_wire(cls, raw: str | bytes) -> Event:
        return cls.model_validate_json(raw)
