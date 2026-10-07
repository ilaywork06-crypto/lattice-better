from fastapi import APIRouter, status

from lattice_core.api.deps import Svc
from lattice_core.schemas.templates import FieldGroupCreate, FieldGroupOut, FieldGroupUpdate
from lattice_core.views.templates import field_group_out

router = APIRouter(prefix="/field-groups", tags=["field groups"])


@router.get("", response_model=list[FieldGroupOut],
            summary="Field groups; search matches a group's name, description or field names")
def list_groups(s: Svc, search: str | None = None):
    return [field_group_out(s, g) for g in s.field_groups.list(search)]


@router.get("/{group_id}", response_model=FieldGroupOut)
def get_group(group_id: int, s: Svc):
    return field_group_out(s, s.field_groups.get(group_id))


@router.post("", response_model=FieldGroupOut, status_code=status.HTTP_201_CREATED)
def create_group(body: FieldGroupCreate, s: Svc):
    return field_group_out(s, s.field_groups.create(body))


@router.patch("/{group_id}", response_model=FieldGroupOut)
def update_group(group_id: int, body: FieldGroupUpdate, s: Svc):
    return field_group_out(s, s.field_groups.update(group_id, body))


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, s: Svc) -> None:
    s.field_groups.delete(group_id)
