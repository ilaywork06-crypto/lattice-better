from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

from lattice_core.domain.enums import CardTracking, CardType


class StockRow(BaseModel):
    """The stock of one card template (all figures in units)."""

    template_id: int
    name: str
    card_type: CardType
    tracking: CardTracking | None = None
    serial_prefix: str
    total: int = 0
    available: int = 0
    desiccator: int = 0
    in_use: int = 0
    assembled: int = 0
    assembled_in_desiccator: int = 0
    faulty: int = 0
    records: int = 0
    available_serials: list[str] = Field(default_factory=list)
    min_quantity: int | None = None
    is_low: bool = False


class ThresholdIn(BaseModel):
    min_quantity: int = Field(ge=0)
    notify_email: EmailStr | None = None


class ThresholdOut(BaseModel):
    id: int
    template_id: int
    name: str
    card_type: CardType | None = None
    tracking: CardTracking | None = None
    min_quantity: int
    notify_email: str | None = None
    available: int = 0
    is_low: bool = False


class Summary(BaseModel):
    setups: int = 0
    assemblies: int = 0
    cards: int = 0
    cards_in_use: int = 0
    cards_in_desiccator: int = 0
    cards_available: int = 0
    faulty_items: int = 0
    pending_change_requests: int = 0
    low_stock: int = 0
    templates: int = 0
