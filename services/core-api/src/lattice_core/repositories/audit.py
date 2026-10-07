from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from sqlalchemy import Select, or_, select

from lattice_core.db.models import AuditEntry
from lattice_core.repositories.base import Repository, like_pattern


class AuditPeriod(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    HALF_YEAR = "half_year"
    YEAR = "year"
    ALL = "all"


PERIOD_DAYS: dict[AuditPeriod, int | None] = {
    AuditPeriod.DAY: 1,
    AuditPeriod.WEEK: 7,
    AuditPeriod.MONTH: 30,
    AuditPeriod.HALF_YEAR: 182,
    AuditPeriod.YEAR: 365,
    AuditPeriod.ALL: None,
}


@dataclass(slots=True)
class AuditFilter:
    item_id: int | None = None
    template_id: int | None = None
    period: AuditPeriod = AuditPeriod.ALL
    action: str | None = None
    search: str | None = None
    # A subquery of item ids ("my items"); None = no restriction.
    item_ids: Select | None = None


class AuditRepository(Repository[AuditEntry]):
    model = AuditEntry
    label = "Audit entry"

    def _filtered(self, f: AuditFilter) -> Select:
        stmt = select(AuditEntry)
        if f.item_id:
            stmt = stmt.where(AuditEntry.item_id == f.item_id)
        if f.template_id:
            stmt = stmt.where(AuditEntry.template_id == f.template_id)
        days = PERIOD_DAYS[f.period]
        if days is not None:
            stmt = stmt.where(AuditEntry.created_at >= datetime.now(UTC) - timedelta(days=days))
        if f.item_ids is not None:
            stmt = stmt.where(AuditEntry.item_id.in_(f.item_ids))
        if f.action:
            stmt = stmt.where(AuditEntry.action == f.action)
        if f.search and f.search.strip():
            like = like_pattern(f.search.strip())
            stmt = stmt.where(
                or_(
                    AuditEntry.summary.ilike(like, escape="\\"),
                    AuditEntry.subject.ilike(like, escape="\\"),
                    AuditEntry.user_name.ilike(like, escape="\\"),
                )
            )
        return stmt.order_by(AuditEntry.created_at.desc(), AuditEntry.id.desc())

    def page(self, f: AuditFilter, *, limit: int, offset: int) -> tuple[list[AuditEntry], int]:
        stmt = self._filtered(f)
        total = self.count(stmt)
        return list(self.all(stmt.offset(offset).limit(limit))), total

    def every(self, f: AuditFilter) -> list[AuditEntry]:
        return list(self.all(self._filtered(f)))
