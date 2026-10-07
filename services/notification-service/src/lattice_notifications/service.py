"""Use cases: store an event's notifications; read and mark them for a user."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from lattice_notifications.db import Notification
from lattice_shared.events import Event


class ReadFilter(StrEnum):
    ALL = "all"
    UNREAD = "unread"
    READ = "read"


@dataclass(slots=True)
class Counts:
    total: int
    unread: int

    @property
    def read(self) -> int:
        return self.total - self.unread


class NotificationNotFound(Exception):
    pass


class NotificationService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ── ingest ──
    def store(self, event: Event) -> int:
        """One row per recipient with a user id. Idempotent per event."""
        user_ids = list(dict.fromkeys(r.user_id for r in event.recipients if r.user_id))
        if not user_ids:
            return 0
        seen = self.session.scalar(
            select(func.count(Notification.id)).where(Notification.event_id == event.id)
        )
        if seen:
            return 0
        for uid in user_ids:
            self.session.add(Notification(
                event_id=event.id, user_id=uid, type=event.type.value, title=event.title,
                body=event.body, payload=event.payload or None, link=event.link,
                created_at=event.created_at,
            ))
        self.session.commit()
        return len(user_ids)

    # ── queries ──
    def page(self, user_id: int, which: ReadFilter, limit: int, offset: int):
        stmt = select(Notification).where(Notification.user_id == user_id)
        if which == ReadFilter.UNREAD:
            stmt = stmt.where(Notification.read.is_(False))
        elif which == ReadFilter.READ:
            stmt = stmt.where(Notification.read.is_(True))
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self.session.scalars(
            stmt.order_by(Notification.created_at.desc(), Notification.id.desc())
            .offset(offset).limit(limit)
        ).all()
        return list(rows), total

    def counts(self, user_id: int) -> Counts:
        total, unread = self.session.execute(
            select(
                func.count(Notification.id),
                func.count(Notification.id).filter(Notification.read.is_(False)),
            ).where(Notification.user_id == user_id)
        ).one()
        return Counts(total=total or 0, unread=unread or 0)

    # ── commands ──
    def mark_read(self, user_id: int, notification_id: int, read: bool = True) -> None:
        n = self.session.get(Notification, notification_id)
        if n is None or n.user_id != user_id:  # someone else's is "not found" too
            raise NotificationNotFound
        n.read = read
        self.session.commit()

    def mark_all_read(self, user_id: int) -> int:
        result = self.session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read.is_(False))
            .values(read=True)
        )
        self.session.commit()
        return result.rowcount or 0
