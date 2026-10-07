from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from lattice_core.db.models import Item, ItemTemplate, Location, StockThreshold
from lattice_core.domain.enums import AVAILABLE_STATES, CardType, ItemState, ItemType
from lattice_core.repositories.base import Repository


class ThresholdRepository(Repository[StockThreshold]):
    model = StockThreshold
    label = "Stock threshold"

    def list(self, template_ids: set[int] | None = None) -> list[StockThreshold]:
        stmt = select(StockThreshold).options(joinedload(StockThreshold.template))
        if template_ids is not None:
            stmt = stmt.where(StockThreshold.template_id.in_(template_ids))
        return list(self.all(stmt))

    def for_template(self, template_id: int) -> StockThreshold | None:
        return self.session.scalar(
            select(StockThreshold).where(StockThreshold.template_id == template_id)
        )


class StockRepository:
    """Read-only queries over card stock."""

    def __init__(self, session) -> None:
        self.session = session

    def card_templates(self, card_type: CardType | None = None) -> list[ItemTemplate]:
        stmt = select(ItemTemplate).where(ItemTemplate.type == ItemType.CARD)
        if card_type is not None:
            stmt = stmt.where(ItemTemplate.card_type == card_type)
        return list(self.session.scalars(stmt.order_by(func.lower(ItemTemplate.name))))

    def live_cards(self, card_type: CardType | None = None) -> list[Item]:
        stmt = (
            select(Item)
            .join(Item.template)
            .options(joinedload(Item.location), joinedload(Item.template))
            .where(Item.type == ItemType.CARD, Item.state != ItemState.DESTROYED)
        )
        if card_type is not None:
            stmt = stmt.where(ItemTemplate.card_type == card_type)
        return list(self.session.scalars(stmt).unique())

    def available(self, template_ids: set[int] | None = None) -> dict[int, int]:
        stmt = (
            select(Item.template_id, func.coalesce(func.sum(Item.quantity), 0))
            .join(Location, Item.location_id == Location.id)
            .where(Location.is_desiccator.is_(True), Item.state.in_(AVAILABLE_STATES))
            .group_by(Item.template_id)
        )
        if template_ids is not None:
            stmt = stmt.where(Item.template_id.in_(template_ids))
        return {tid: int(n) for tid, n in self.session.execute(stmt)}

    def units(self, *conditions) -> int:
        return self.session.scalar(
            select(func.coalesce(func.sum(Item.quantity), 0)).where(
                Item.state != ItemState.DESTROYED, *conditions
            )
        ) or 0
