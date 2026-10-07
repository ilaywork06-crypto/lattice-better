from fastapi import APIRouter, status

from lattice_core.api.deps import Svc
from lattice_core.domain.enums import CardType
from lattice_core.domain.permissions import Permission
from lattice_core.schemas.inventory import StockRow, Summary, ThresholdIn, ThresholdOut

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/summary", response_model=Summary, summary="Dashboard figures")
def summary(s: Svc):
    s.require(Permission.READ)
    return s.inventory.summary()


@router.get("/stock", response_model=list[StockRow], summary="Stock per card template")
def stock(s: Svc, card_type: CardType | None = None, in_desiccator: bool = False):
    s.require(Permission.READ)
    rows = s.inventory.stock(card_type)
    return [r for r in rows if r.desiccator > 0] if in_desiccator else rows


@router.get("/thresholds", response_model=list[ThresholdOut])
def thresholds(s: Svc, low_only: bool = False):
    s.require(Permission.READ)
    rows = s.inventory.thresholds()
    return [t for t in rows if t.is_low] if low_only else rows


@router.put("/thresholds/{template_id}", response_model=ThresholdOut,
            summary="Set (or replace) a card template's minimum available stock")
def set_threshold(template_id: int, body: ThresholdIn, s: Svc):
    return s.inventory.set_threshold(template_id, body)


@router.delete("/thresholds/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_threshold(template_id: int, s: Svc) -> None:
    s.inventory.delete_threshold(template_id)
