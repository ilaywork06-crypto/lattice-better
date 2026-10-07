from __future__ import annotations

from sqlalchemy import func, or_, select

from lattice_core.db.models import ChangeRequest, User
from lattice_core.domain.enums import UserRole
from lattice_core.repositories.base import Repository, like_pattern


class UserRepository(Repository[User]):
    model = User
    label = "User"

    def by_email(self, email: str) -> User | None:
        return self.session.scalar(select(User).where(func.lower(User.email) == email.lower()))

    def by_name_or_email(self, text: str) -> User | None:
        return self.session.scalar(
            select(User).where(or_(func.lower(User.email) == text.lower(), User.full_name == text))
        )

    def list(self, *, role: UserRole | None = None, active: bool | None = None) -> list[User]:
        stmt = select(User).order_by(func.lower(User.full_name))
        if role is not None:
            stmt = stmt.where(User.role == role)
        if active is not None:
            stmt = stmt.where(User.is_active.is_(active))
        return list(self.all(stmt))

    def active_managers(self) -> list[User]:
        return self.list(role=UserRole.MANAGER, active=True)

    def login_hints(self) -> list[User]:
        stmt = (
            select(User)
            .where(User.login_hint_visible.is_(True), User.is_active.is_(True))
            .order_by(User.full_name)
        )
        return list(self.all(stmt))

    def proposal_count(self, user_id: int) -> int:
        return self.count(select(ChangeRequest.id).where(ChangeRequest.proposed_by == user_id))

    def search(self, term: str, limit: int) -> list[User]:
        like = like_pattern(term)
        stmt = select(User).where(
            or_(User.full_name.ilike(like, escape="\\"), User.email.ilike(like, escape="\\"))
        ).limit(limit)
        return list(self.all(stmt))
