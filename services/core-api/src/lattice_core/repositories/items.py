from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import joinedload, selectinload

from lattice_core.db.models import (
    CatalogOption,
    Item,
    ItemTemplate,
    Location,
    TemplateChild,
    item_managers,
)
from lattice_core.domain.enums import CardType, ItemState, ItemType, StorageStatus
from lattice_core.repositories.base import Repository, like_pattern


@dataclass(slots=True)
class ItemFilter:
    type: ItemType | None = None
    template_id: int | None = None
    state: ItemState | None = None
    card_type: CardType | None = None
    storage: StorageStatus | None = None
    location_id: int | None = None
    parent_id: int | None = None
    top_level: bool | None = None
    include_destroyed: bool = True
    # Items whose template may be placed inside this template.
    fits_in_template: int | None = None
    # Items whose template may hold this template.
    holds_template: int | None = None
    search: str | None = None


_LIST_OPTIONS = (
    joinedload(Item.template).selectinload(ItemTemplate.child_links),
    joinedload(Item.location),
    joinedload(Item.parent).joinedload(Item.template),
    joinedload(Item.industry),
    joinedload(Item.project),
    joinedload(Item.team),
    selectinload(Item.managers),
    selectinload(Item.children),
)


class ItemRepository(Repository[Item]):
    model = Item
    label = "Item"

    def _filtered(self, f: ItemFilter) -> Select:
        stmt = select(Item).join(Item.template)
        if f.type:
            stmt = stmt.where(Item.type == f.type)
        if f.template_id:
            stmt = stmt.where(Item.template_id == f.template_id)
        if f.state:
            stmt = stmt.where(Item.state == f.state)
        if not f.include_destroyed:
            stmt = stmt.where(Item.state != ItemState.DESTROYED)
        if f.card_type:
            stmt = stmt.where(ItemTemplate.card_type == f.card_type)
        if f.location_id:
            stmt = stmt.where(Item.location_id == f.location_id)
        if f.parent_id:
            stmt = stmt.where(Item.parent_id == f.parent_id)
        if f.top_level:
            stmt = stmt.where(Item.parent_id.is_(None))
        if f.storage:
            stmt = stmt.where(Item.type == ItemType.CARD).outerjoin(
                Location, Item.location_id == Location.id
            )
            inside = Location.is_desiccator.is_(True)
            outside = or_(Location.id.is_(None), Location.is_desiccator.is_(False))
            if f.storage == StorageStatus.DESICCATOR:
                stmt = stmt.where(inside)
            elif f.storage == StorageStatus.ASSEMBLED:
                stmt = stmt.where(Item.parent_id.is_not(None), outside)
            else:
                stmt = stmt.where(Item.parent_id.is_(None), outside)
        if f.fits_in_template:
            stmt = stmt.join(
                TemplateChild,
                and_(
                    TemplateChild.child_template_id == Item.template_id,
                    TemplateChild.parent_template_id == f.fits_in_template,
                ),
            )
        if f.holds_template:
            holder = TemplateChild.__table__.alias("holder")
            stmt = stmt.join(
                holder,
                and_(
                    holder.c.parent_template_id == Item.template_id,
                    holder.c.child_template_id == f.holds_template,
                ),
            )
        if f.search and f.search.strip():
            like = like_pattern(f.search.strip())
            stmt = stmt.where(
                or_(
                    ItemTemplate.name.ilike(like, escape="\\"),
                    Item.serial.ilike(like, escape="\\"),
                )
            )
        return stmt

    def page(self, f: ItemFilter, *, limit: int, offset: int) -> tuple[list[Item], int]:
        stmt = self._filtered(f)
        total = self.count(stmt.with_only_columns(Item.id))
        rows = self.session.scalars(
            stmt.options(*_LIST_OPTIONS)
            .order_by(Item.type, func.lower(ItemTemplate.name), Item.serial)
            .offset(offset)
            .limit(limit)
        ).unique().all()
        return list(rows), total

    def by_serial(self, serial: str) -> Item | None:
        return self.session.scalar(select(Item).where(Item.serial == serial.strip().upper()))

    def serials_like(self, head: str) -> list[str]:
        return list(self.session.scalars(select(Item.serial).where(Item.serial.like(f"{head}%"))))

    def of_template(self, template_id: int) -> list[Item]:
        return list(
            self.all(
                select(Item).options(joinedload(Item.template))
                .where(Item.template_id == template_id)
                .order_by(Item.serial)
            )
        )

    def everything(self) -> list[Item]:
        return list(self.all(select(Item).options(joinedload(Item.template))))

    def linked_to_user_ids(self, user_id: int) -> Select:
        """A subquery of the ids of items a user manages or is responsible for."""
        managed = select(item_managers.c.item_id).where(item_managers.c.user_id == user_id)
        responsible = select(Item.id).where(Item.responsible_id == user_id)
        return managed.union(responsible)

    def manager_ids_of_template(self, template_id: int) -> set[int]:
        rows = self.session.execute(
            select(item_managers.c.user_id)
            .join(Item, Item.id == item_managers.c.item_id)
            .where(Item.template_id == template_id)
        )
        return {r[0] for r in rows}

    def search(self, term: str, limit: int) -> list[Item]:
        like = like_pattern(term)
        stmt = (
            select(Item)
            .join(Item.template)
            .outerjoin(
                CatalogOption,
                or_(
                    CatalogOption.id == Item.project_id,
                    CatalogOption.id == Item.industry_id,
                    CatalogOption.id == Item.team_id,
                ),
            )
            .options(joinedload(Item.location), joinedload(Item.template),
                     joinedload(Item.project), joinedload(Item.industry), joinedload(Item.team))
            .where(
                or_(
                    ItemTemplate.name.ilike(like, escape="\\"),
                    Item.serial.ilike(like, escape="\\"),
                    CatalogOption.value.ilike(like, escape="\\"),
                )
            )
            .limit(limit)
        )
        return list(self.session.scalars(stmt).unique().all())
