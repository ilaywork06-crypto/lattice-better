"""Reading the audit log."""

from __future__ import annotations

from lattice_core.db.models import AuditEntry
from lattice_core.domain.permissions import Permission
from lattice_core.repositories.audit import AuditFilter, AuditPeriod
from lattice_core.services.base import Service


class AuditLogService(Service):
    def filter(self, *, item_id: int | None = None, template_id: int | None = None,
               period: AuditPeriod = AuditPeriod.ALL, mine: bool = False,
               action: str | None = None, search: str | None = None) -> AuditFilter:
        """``mine`` keeps only entries of items linked to me (I manage them or am
        responsible for them) — nothing else, and nothing if I'm linked to none."""
        user = self.services.require(Permission.READ)
        return AuditFilter(
            item_id=item_id, template_id=template_id, period=period, action=action,
            search=search,
            item_ids=self.uow.items.linked_to_user_ids(user.id) if mine else None,
        )

    def page(self, f: AuditFilter, *, limit: int, offset: int) -> tuple[list[AuditEntry], int]:
        return self.uow.audit.page(f, limit=limit, offset=offset)
