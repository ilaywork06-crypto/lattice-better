from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from lattice_core.db.base import Base, enum_column, utcnow
from lattice_core.domain.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(enum_column(UserRole, "user_role"),
                                           default=UserRole.VIEWER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Sign-in screen shortcuts. The endpoint serving them is unauthenticated by
    # necessity (it *is* the login page), so both default to off: nothing is
    # published without a manager's deliberate decision.
    login_hint_visible: Mapped[bool] = mapped_column(Boolean, default=False)
    login_hint_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
