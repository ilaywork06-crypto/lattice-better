from __future__ import annotations

from sqlalchemy import delete, func, or_, select

from lattice_core.db.models import CatalogLink, CatalogOption, Item
from lattice_core.domain.enums import CatalogCategory
from lattice_core.repositories.base import Repository

_ITEM_COLUMN = {
    CatalogCategory.INDUSTRY: Item.industry_id,
    CatalogCategory.PROJECT: Item.project_id,
    CatalogCategory.TEAM: Item.team_id,
}


def ordered_pair(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


class CatalogRepository(Repository[CatalogOption]):
    model = CatalogOption
    label = "Catalog value"

    def list(self, category: CatalogCategory | None = None, active_only: bool = False):
        stmt = select(CatalogOption).order_by(
            CatalogOption.category, CatalogOption.sort_order, func.lower(CatalogOption.value)
        )
        if category is not None:
            stmt = stmt.where(CatalogOption.category == category)
        if active_only:
            stmt = stmt.where(CatalogOption.active.is_(True))
        return list(self.all(stmt))

    def find(self, category: CatalogCategory, value: str) -> CatalogOption | None:
        return self.session.scalar(
            select(CatalogOption).where(
                CatalogOption.category == category,
                func.lower(CatalogOption.value) == value.strip().lower(),
            )
        )

    def usage_counts(self) -> dict[int, int]:
        out: dict[int, int] = {}
        for column in _ITEM_COLUMN.values():
            rows = self.session.execute(
                select(column, func.count(Item.id)).where(column.is_not(None)).group_by(column)
            )
            for option_id, n in rows:
                out[option_id] = out.get(option_id, 0) + n
        return out

    def usage_count(self, option: CatalogOption) -> int:
        column = _ITEM_COLUMN[option.category]
        return self.count(select(Item.id).where(column == option.id))

    # ── links ──
    def all_links(self) -> list[tuple[int, int]]:
        rows = self.session.execute(select(CatalogLink.option_a_id, CatalogLink.option_b_id))
        return [(a, b) for a, b in rows]

    def linked_ids(self, option_id: int) -> list[int]:
        rows = self.session.scalars(
            select(CatalogLink).where(
                or_(CatalogLink.option_a_id == option_id, CatalogLink.option_b_id == option_id)
            )
        )
        return [r.option_b_id if r.option_a_id == option_id else r.option_a_id for r in rows]

    def link(self, a: int, b: int) -> None:
        lo, hi = ordered_pair(a, b)
        if self.session.get(CatalogLink, (lo, hi)) is None:
            self.session.add(CatalogLink(option_a_id=lo, option_b_id=hi))

    def unlink(self, a: int, b: int) -> None:
        lo, hi = ordered_pair(a, b)
        self.session.execute(
            delete(CatalogLink).where(CatalogLink.option_a_id == lo, CatalogLink.option_b_id == hi)
        )
