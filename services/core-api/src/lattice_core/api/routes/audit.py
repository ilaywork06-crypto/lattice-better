from datetime import UTC, datetime

from fastapi import APIRouter, Query
from fastapi.responses import Response

from lattice_core.api.deps import Svc
from lattice_core.repositories.audit import AuditPeriod
from lattice_core.schemas.common import Page
from lattice_core.schemas.workflow import AuditOut
from lattice_core.services.spreadsheets import XLSX

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=Page[AuditOut])
def list_audit(
    s: Svc,
    item_id: int | None = None,
    template_id: int | None = None,
    period: AuditPeriod = AuditPeriod.ALL,
    mine: bool = Query(False, description="Only items I manage or am responsible for"),
    action: str | None = None,
    q: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    f = s.audit_log.filter(item_id=item_id, template_id=template_id, period=period, mine=mine,
                           action=action, search=q)
    rows, total = s.audit_log.page(f, limit=limit, offset=offset)
    return Page(items=[AuditOut.model_validate(r) for r in rows], total=total, limit=limit,
                offset=offset)


@router.get("/export", summary="The same filters, as an Excel workbook")
def export_audit(
    s: Svc,
    item_id: int | None = None,
    template_id: int | None = None,
    period: AuditPeriod = AuditPeriod.ALL,
    mine: bool = False,
    action: str | None = None,
    q: str | None = None,
):
    f = s.audit_log.filter(item_id=item_id, template_id=template_id, period=period, mine=mine,
                           action=action, search=q)
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return Response(
        s.spreadsheets.export_audit(f),
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="lattice_audit_{stamp}.xlsx"'},
    )
