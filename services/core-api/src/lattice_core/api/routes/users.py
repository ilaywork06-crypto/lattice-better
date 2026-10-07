from fastapi import APIRouter, status

from lattice_core.api.deps import Svc
from lattice_core.db.models import User
from lattice_core.schemas.users import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def user_out(u: User) -> UserOut:
    out = UserOut.model_validate(u)
    out.login_hint_has_password = bool(u.login_hint_password)
    return out


@router.get("", response_model=list[UserOut])
def list_users(s: Svc):
    return [user_out(u) for u in s.users.list()]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, s: Svc):
    return user_out(s.users.create(body))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, s: Svc):
    return user_out(s.users.update(user_id, body))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, s: Svc) -> None:
    s.users.delete(user_id)
