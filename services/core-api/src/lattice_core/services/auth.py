"""Signing in."""

from __future__ import annotations

from lattice_core.db.models import User
from lattice_core.domain.errors import PermissionDenied, Unauthenticated
from lattice_core.infra.security import TokenService, verify_password
from lattice_core.services.base import Service


class AuthService(Service):
    def authenticate(self, email: str, password: str) -> User:
        user = self.uow.users.by_email(email.strip())
        if user is None or not verify_password(password, user.hashed_password):
            raise Unauthenticated("Incorrect email or password")
        if not user.is_active:
            raise PermissionDenied("This account has been deactivated")
        return user

    def issue_token(self, user: User) -> str:
        return self.tokens().issue(user.id, user.role.value)

    def user_from_token(self, token: str) -> User:
        user = self.uow.users.get(self.tokens().user_id(token))
        if user is None or not user.is_active:
            raise Unauthenticated("Your session is no longer valid — sign in again")
        return user

    def login_hints(self) -> list[User]:
        return self.uow.users.login_hints()

    def tokens(self) -> TokenService:
        s = self.settings
        return TokenService(s.jwt_secret, s.jwt_algorithm, s.access_token_expire_minutes)
