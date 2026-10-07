from fastapi import APIRouter, Query, status

from lattice_core.api.deps import Svc
from lattice_core.domain.enums import ChangeStatus
from lattice_core.schemas.common import Note, Page
from lattice_core.schemas.workflow import ChangeRequestCreate, ChangeRequestOut
from lattice_core.views.workflow import change_request_out

router = APIRouter(prefix="/change-requests", tags=["change requests"])


@router.get("", response_model=Page[ChangeRequestOut])
def list_requests(s: Svc, status: ChangeStatus | None = None, mine: bool = False,
                  limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    rows, total = s.workflow.page(status=status, mine=mine, limit=limit, offset=offset)
    return Page(items=[change_request_out(r) for r in rows], total=total, limit=limit,
                offset=offset)


@router.get("/{cr_id}", response_model=ChangeRequestOut)
def get_request(cr_id: int, s: Svc):
    return change_request_out(s.workflow.get(cr_id))


@router.post("", response_model=ChangeRequestOut, status_code=status.HTTP_201_CREATED,
             summary="Propose a change for a manager to approve")
def submit(body: ChangeRequestCreate, s: Svc):
    return change_request_out(s.workflow.submit(body))


@router.post("/{cr_id}/approve", response_model=ChangeRequestOut,
             summary="Approve and apply a proposal")
def approve(cr_id: int, s: Svc, body: Note | None = None):
    return change_request_out(s.workflow.approve(cr_id, body.note if body else None))


@router.post("/{cr_id}/reject", response_model=ChangeRequestOut)
def reject(cr_id: int, s: Svc, body: Note | None = None):
    return change_request_out(s.workflow.reject(cr_id, body.note if body else None))
