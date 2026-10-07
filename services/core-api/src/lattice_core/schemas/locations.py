from __future__ import annotations

from pydantic import BaseModel, Field

from lattice_core.schemas.common import Schema


class LocationOut(Schema):
    id: int
    name: str
    building: str | None = None
    room: str | None = None
    x: float
    y: float
    notes: str | None = None
    is_desiccator: bool = False
    item_count: int = 0


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    building: str | None = None
    room: str | None = None
    x: float = Field(default=50.0, ge=0, le=100)
    y: float = Field(default=50.0, ge=0, le=100)
    notes: str | None = None
    is_desiccator: bool = False


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    building: str | None = None
    room: str | None = None
    x: float | None = Field(default=None, ge=0, le=100)
    y: float | None = Field(default=None, ge=0, le=100)
    notes: str | None = None
    is_desiccator: bool | None = None


class DesiccatorUpdate(BaseModel):
    location_ids: list[int] = Field(default_factory=list)


class BuildingIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    x: float = Field(default=5.0, ge=0, le=100)
    y: float = Field(default=5.0, ge=0, le=100)
    width: float = Field(default=30.0, gt=0, le=100)
    height: float = Field(default=20.0, gt=0, le=100)
    color: str | None = None
    notes: str | None = None
    sort_order: int = 0


class BuildingUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    x: float | None = Field(default=None, ge=0, le=100)
    y: float | None = Field(default=None, ge=0, le=100)
    width: float | None = Field(default=None, gt=0, le=100)
    height: float | None = Field(default=None, gt=0, le=100)
    color: str | None = None
    notes: str | None = None
    sort_order: int | None = None


class BuildingOut(BuildingIn, Schema):
    id: int
