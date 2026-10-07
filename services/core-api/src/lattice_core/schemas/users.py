from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from lattice_core.domain.enums import ChangeAction, UserRole
from lattice_core.domain.permissions import Permission
from lattice_core.schemas.common import Password, Schema, UserRef


class UserOut(UserRef):
    is_active: bool
    created_at: datetime
    login_hint_visible: bool = False
    # Whether a password is published with the shortcut — never the value.
    login_hint_has_password: bool = False


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: Password
    role: UserRole = UserRole.VIEWER


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None
    password: Password | None = None
    login_hint_visible: bool | None = None
    # "" stops publishing the password; None leaves it as it is.
    login_hint_password: str | None = None


class Me(UserOut):
    permissions: list[Permission]
    proposable_actions: list[ChangeAction]


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Me


class LoginHint(Schema):
    full_name: str
    email: str
    role: UserRole
    password: str | None = None
