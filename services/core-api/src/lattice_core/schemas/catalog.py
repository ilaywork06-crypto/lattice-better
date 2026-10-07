from __future__ import annotations

from pydantic import BaseModel, Field

from lattice_core.domain.enums import CatalogCategory
from lattice_core.schemas.common import Schema


class CatalogOptionOut(Schema):
    id: int
    category: CatalogCategory
    value: str
    description: str | None = None
    active: bool
    sort_order: int
    usage_count: int = 0
    linked_ids: list[int] = Field(default_factory=list)


class CatalogOptionCreate(BaseModel):
    category: CatalogCategory
    value: str = Field(min_length=1, max_length=255)
    description: str | None = None
    active: bool = True
    sort_order: int = 0


class CatalogOptionUpdate(BaseModel):
    value: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    active: bool | None = None
    sort_order: int | None = None


class CatalogLinksUpdate(BaseModel):
    """This value's links to one *other* category, as the end state."""

    category: CatalogCategory
    option_ids: list[int] = Field(default_factory=list)
