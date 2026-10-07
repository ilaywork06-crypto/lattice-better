"""User accounts and roles."""

from __future__ import annotations

from lattice_core.db.models import User
from lattice_core.domain.enums import FieldType
from lattice_core.domain.errors import Conflict, RuleViolation
from lattice_core.domain.permissions import Permission
from lattice_core.infra.security import hash_password
from lattice_core.schemas.users import UserCreate, UserUpdate
from lattice_core.services.base import Service
from lattice_core.services.references import forget_reference


class UserService(Service):
    def list(self) -> list[User]:
        self.services.require(Permission.READ)
        return self.uow.users.list()

    def create(self, cmd: UserCreate) -> User:
        self.services.require(Permission.MANAGE_USERS)
        with self.uow.transaction():
            if self.uow.users.by_email(cmd.email):
                raise Conflict(f"{cmd.email} is already registered")
            user = self.uow.users.add(User(
                email=str(cmd.email).lower(),
                full_name=cmd.full_name.strip(),
                hashed_password=hash_password(cmd.password),
                role=cmd.role,
            ))
            self.uow.session.flush()
            self.audit.record("user.create", f"Created user {user.email} ({user.role.value})",
                              details={"user_id": user.id})
            return user

    def update(self, user_id: int, cmd: UserUpdate) -> User:
        me = self.services.require(Permission.MANAGE_USERS)
        with self.uow.transaction():
            user = self.uow.users.require(user_id)
            if user.id == me.id and (cmd.is_active is False or
                                     (cmd.role is not None and cmd.role != user.role)):
                raise RuleViolation("You cannot deactivate yourself or change your own role")
            if cmd.full_name is not None:
                user.full_name = cmd.full_name.strip()
            if cmd.role is not None:
                user.role = cmd.role
            if cmd.is_active is not None:
                user.is_active = cmd.is_active
            if cmd.password:
                user.hashed_password = hash_password(cmd.password)
            if cmd.login_hint_visible is not None:
                user.login_hint_visible = cmd.login_hint_visible
            if cmd.login_hint_password is not None:
                user.login_hint_password = cmd.login_hint_password.strip() or None
            # Publishing an account on the sign-in screen is security-relevant,
            # so it is recorded as a fact of its own.
            self.audit.record(
                "user.update",
                f"Updated user {user.email}",
                details={
                    "user_id": user.id,
                    "fields": sorted(cmd.model_fields_set - {"password", "login_hint_password"}),
                    "password_changed": bool(cmd.password),
                    "login_hint_visible": user.login_hint_visible,
                    "login_hint_password_set": bool(user.login_hint_password),
                },
            )
            return user

    def delete(self, user_id: int) -> None:
        me = self.services.require(Permission.MANAGE_USERS)
        with self.uow.transaction():
            user = self.uow.users.require(user_id)
            if user.id == me.id:
                raise RuleViolation("You cannot delete yourself")
            proposals = self.uow.users.proposal_count(user.id)
            if proposals:
                raise Conflict(
                    f"{user.full_name} has {proposals} change request(s) on record and can't be "
                    "deleted without breaking the audit trail. Deactivate the account instead — "
                    "it blocks sign-in and keeps the history intact."
                )
            forget_reference(self.uow, {FieldType.MANAGERS, FieldType.RESPONSIBLE}, user.id)
            self.audit.record("user.delete", f"Deleted user {user.email}",
                              details={"user_id": user.id})
            self.uow.users.delete(user)
