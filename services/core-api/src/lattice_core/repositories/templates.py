from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import func, or_, select
from sqlalchemy.orm import aliased, selectinload

from lattice_core.db.models import (
    FieldGroup,
    FieldGroupField,
    Item,
    ItemTemplate,
    TemplateChild,
    TemplateField,
)
from lattice_core.domain.enums import CardType, FieldType, ItemState, ItemType
from lattice_core.repositories.base import Repository, like_pattern


@dataclass(slots=True)
class StateCounts:
    """Units per state. ``total`` excludes destroyed units — they are history."""

    built: int = 0
    ok: int = 0
    faulty: int = 0
    destroyed: int = 0

    @property
    def total(self) -> int:
        return self.built + self.ok + self.faulty


class TemplateRepository(Repository[ItemTemplate]):
    model = ItemTemplate
    label = "Template"

    def list(
        self,
        *,
        type: ItemType | None = None,
        card_type: CardType | None = None,
        search: str | None = None,
    ) -> list[ItemTemplate]:
        stmt = select(ItemTemplate).options(
            selectinload(ItemTemplate.fields),
            selectinload(ItemTemplate.child_links),
            selectinload(ItemTemplate.parent_links),
        )
        if type is not None:
            stmt = stmt.where(ItemTemplate.type == type)
        if card_type is not None:
            stmt = stmt.where(ItemTemplate.card_type == card_type)
        if search and search.strip():
            like = like_pattern(search.strip())
            stmt = stmt.where(
                or_(
                    ItemTemplate.name.ilike(like, escape="\\"),
                    ItemTemplate.serial_prefix.ilike(like, escape="\\"),
                )
            )
        return list(self.all(stmt.order_by(ItemTemplate.type, func.lower(ItemTemplate.name))))

    def name_clash(self, type: ItemType, name: str, exclude_id: int | None) -> ItemTemplate | None:
        return self.session.scalar(
            select(ItemTemplate).where(
                ItemTemplate.type == type,
                func.lower(ItemTemplate.name) == name.lower(),
                ItemTemplate.id != (exclude_id or -1),
            )
        )

    def prefix_clash(self, type: ItemType, prefix: str, exclude_id: int | None):
        return self.session.scalar(
            select(ItemTemplate).where(
                ItemTemplate.type == type,
                ItemTemplate.serial_prefix == prefix,
                ItemTemplate.id != (exclude_id or -1),
            )
        )

    def by_type_and_prefix(self, type: ItemType, prefix: str) -> ItemTemplate | None:
        return self.session.scalar(
            select(ItemTemplate).where(ItemTemplate.type == type,
                                       ItemTemplate.serial_prefix == prefix)
        )

    def by_name(self, name: str) -> ItemTemplate | None:
        return self.session.scalar(
            select(ItemTemplate).where(func.lower(ItemTemplate.name) == name.strip().lower())
        )

    def state_counts(self, template_ids: list[int] | None = None) -> dict[int, StateCounts]:
        stmt = select(Item.template_id, Item.state, func.coalesce(func.sum(Item.quantity), 0))
        if template_ids is not None:
            stmt = stmt.where(Item.template_id.in_(template_ids))
        out: dict[int, StateCounts] = defaultdict(StateCounts)
        for tid, state, units in self.session.execute(
            stmt.group_by(Item.template_id, Item.state)
        ):
            c = out[tid]
            setattr(c, ItemState(state).value, int(units or 0))
        return out

    def item_count(self, template_id: int) -> int:
        return self.count(select(Item.id).where(Item.template_id == template_id))

    def items_of(self, template_id: int) -> list[Item]:
        return list(self.all(select(Item).where(Item.template_id == template_id)))

    def multi_unit_items(self, template_id: int) -> int:
        return self.count(
            select(Item.id).where(Item.template_id == template_id, Item.quantity > 1)
        )

    def items_inside(self, parent_template_id: int, child_template_id: int) -> int:
        """How many items of ``child`` sit inside items of ``parent``."""
        parent = aliased(Item)
        return self.count(
            select(Item.id)
            .join(parent, Item.parent_id == parent.id)
            .where(Item.template_id == child_template_id, parent.template_id == parent_template_id)
        )

    def fullest_container(self, parent_template_id: int, child_template_id: int) -> int:
        """The most live units of ``child`` that any one item of ``parent`` holds."""
        parent = aliased(Item)
        per_parent = (
            select(func.sum(Item.quantity).label("units"))
            .join(parent, Item.parent_id == parent.id)
            .where(
                Item.template_id == child_template_id,
                parent.template_id == parent_template_id,
                Item.state != ItemState.DESTROYED,
            )
            .group_by(parent.id)
            .subquery()
        )
        return self.session.scalar(select(func.coalesce(func.max(per_parent.c.units), 0))) or 0

    def fields_of_types(self, types: set[FieldType]) -> list[TemplateField]:
        return list(self.all(select(TemplateField).where(TemplateField.field_type.in_(types))))

    def child_link(self, parent_id: int, child_id: int) -> TemplateChild | None:
        return self.session.get(TemplateChild, (parent_id, child_id))

    def search(self, term: str, limit: int) -> list[ItemTemplate]:
        return self.list(search=term)[:limit]

    def all_templates(self) -> list[ItemTemplate]:
        return self.list()


class TemplateFieldRepository(Repository[TemplateField]):
    model = TemplateField
    label = "Field"


class FieldGroupRepository(Repository[FieldGroup]):
    model = FieldGroup
    label = "Field group"

    def list(self, search: str | None = None) -> list[FieldGroup]:
        stmt = select(FieldGroup).options(selectinload(FieldGroup.fields))
        if search and search.strip():
            like = like_pattern(search.strip())
            stmt = stmt.where(
                or_(
                    FieldGroup.name.ilike(like, escape="\\"),
                    FieldGroup.description.ilike(like, escape="\\"),
                    FieldGroup.fields.any(FieldGroupField.label.ilike(like, escape="\\")),
                )
            )
        return list(self.all(stmt.order_by(func.lower(FieldGroup.name))))

    def name_clash(self, name: str, exclude_id: int | None) -> FieldGroup | None:
        return self.session.scalar(
            select(FieldGroup).where(
                func.lower(FieldGroup.name) == name.lower(), FieldGroup.id != (exclude_id or -1)
            )
        )

    def fields_of_types(self, types: set[FieldType]) -> list[FieldGroupField]:
        return list(self.all(select(FieldGroupField).where(FieldGroupField.field_type.in_(types))))
