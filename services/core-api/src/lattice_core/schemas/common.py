from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from lattice_core.domain.enums import CardType, ItemState, ItemType, UserRole
from lattice_core.infra.security import BCRYPT_MAX_BYTES


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    """One page of a longer list."""

    items: list[T]
    total: int
    limit: int
    offset: int


def _bcrypt_safe(value: str) -> str:
    encoded = len(value.encode("utf-8"))
    if encoded > BCRYPT_MAX_BYTES:
        raise ValueError(
            f"Password is too long: {encoded} bytes, the maximum is {BCRYPT_MAX_BYTES} "
            "(non-Latin characters use 2–4 bytes each)"
        )
    return value


Password = Annotated[str, Field(min_length=6), AfterValidator(_bcrypt_safe)]


class UserRef(Schema):
    id: int
    full_name: str
    email: str
    role: UserRole


class CatalogRef(Schema):
    id: int
    value: str


class LocationRef(Schema):
    id: int
    name: str
    is_desiccator: bool = False


class TemplateRef(Schema):
    id: int
    type: ItemType
    name: str
    card_type: CardType | None = None
    serial_prefix: str


class ItemRef(Schema):
    id: int
    type: ItemType
    template_id: int
    name: str
    serial: str
    state: ItemState
    card_type: CardType | None = None


class Note(BaseModel):
    note: str | None = None


class Timestamped(Schema):
    created_at: datetime
