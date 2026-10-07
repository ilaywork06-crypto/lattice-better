from __future__ import annotations

from lattice_core.db.models import ChangeRequest
from lattice_core.schemas.workflow import ChangeRequestOut


def change_request_out(cr: ChangeRequest) -> ChangeRequestOut:
    return ChangeRequestOut.model_validate(cr)
