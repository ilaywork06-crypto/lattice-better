from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from lattice_core.db.models import ChangeRequest
from lattice_core.domain.enums import ChangeStatus
from lattice_core.repositories.base import Repository


class ChangeRequestRepository(Repository[ChangeRequest]):
    model = ChangeRequest
    label = "Change request"

    def page(
        self,
        *,
        status: ChangeStatus | None,
        proposed_by: int | None,
        limit: int,
        offset: int,
    ) -> tuple[list[ChangeRequest], int]:
        stmt = select(ChangeRequest)
        if status is not None:
            stmt = stmt.where(ChangeRequest.status == status)
        if proposed_by is not None:
            stmt = stmt.where(ChangeRequest.proposed_by == proposed_by)
        total = self.count(stmt)
        rows = self.all(
            stmt.options(joinedload(ChangeRequest.proposer), joinedload(ChangeRequest.reviewer))
            .order_by(ChangeRequest.created_at.desc(), ChangeRequest.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(rows), total

    def pending_count(self) -> int:
        return self.session.scalar(
            select(func.count(ChangeRequest.id)).where(ChangeRequest.status == ChangeStatus.PENDING)
        ) or 0
