"""Password hashing (bcrypt) and access tokens (JWT)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from lattice_core.domain.errors import Unauthenticated

BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


class TokenService:
    def __init__(self, secret: str, algorithm: str, ttl_minutes: int) -> None:
        self._secret = secret
        self._algorithm = algorithm
        self._ttl = timedelta(minutes=ttl_minutes)

    def issue(self, user_id: int, role: str) -> str:
        now = datetime.now(UTC)
        payload = {"sub": str(user_id), "role": role, "iat": now, "exp": now + self._ttl}
        return jwt.encode(payload, self._secret, algorithm=self._algorithm)

    def user_id(self, token: str) -> int:
        try:
            payload = jwt.decode(token, self._secret, algorithms=[self._algorithm])
            return int(payload["sub"])
        except (jwt.PyJWTError, KeyError, TypeError, ValueError):
            raise Unauthenticated(
                "Your session is invalid or has expired — sign in again"
            ) from None
