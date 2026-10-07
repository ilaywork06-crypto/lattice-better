"""The Unit of Work: one database transaction plus what must follow it.

Side effects that must not happen unless the transaction commits — publishing
events, deleting files from storage, re-checking stock — are *queued* on the
unit of work and run after a successful commit. Files written during a
transaction that rolls back are removed again, so storage never drifts from
the database.

``transaction()`` is re-entrant: only the outermost block commits, so use
cases can call each other freely.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterator
from contextlib import contextmanager

from sqlalchemy.orm import Session

from lattice_core.infra.events import EventPublisher
from lattice_core.infra.storage import FileStorage
from lattice_core.repositories.audit import AuditRepository
from lattice_core.repositories.catalog import CatalogRepository
from lattice_core.repositories.change_requests import ChangeRequestRepository
from lattice_core.repositories.documents import DocumentRepository
from lattice_core.repositories.inventory import StockRepository, ThresholdRepository
from lattice_core.repositories.items import ItemRepository
from lattice_core.repositories.locations import LocationRepository, MapBuildingRepository
from lattice_core.repositories.templates import (
    FieldGroupRepository,
    TemplateFieldRepository,
    TemplateRepository,
)
from lattice_core.repositories.users import UserRepository
from lattice_shared.events import Event

logger = logging.getLogger("lattice_core.uow")


class UnitOfWork:
    def __init__(self, session: Session, publisher: EventPublisher, storage: FileStorage) -> None:
        self.session = session
        self.publisher = publisher
        self.storage = storage

        self.users = UserRepository(session)
        self.catalog = CatalogRepository(session)
        self.locations = LocationRepository(session)
        self.buildings = MapBuildingRepository(session)
        self.templates = TemplateRepository(session)
        self.template_fields = TemplateFieldRepository(session)
        self.field_groups = FieldGroupRepository(session)
        self.items = ItemRepository(session)
        self.documents = DocumentRepository(session)
        self.change_requests = ChangeRequestRepository(session)
        self.audit = AuditRepository(session)
        self.thresholds = ThresholdRepository(session)
        self.stock = StockRepository(session)

        self._depth = 0
        self._events: list[Event] = []
        self._after_commit: list[Callable[[], None]] = []
        self._files_written: list[str] = []
        self._files_to_delete: list[str] = []
        #: Card templates whose stock this transaction may have changed.
        self.stock_touched: set[int] = set()

    # ── transaction ──
    @contextmanager
    def transaction(self) -> Iterator[UnitOfWork]:
        self._depth += 1
        try:
            yield self
            if self._depth == 1:
                self.session.flush()
        except BaseException:
            if self._depth == 1:
                self._rollback()
            raise
        finally:
            self._depth -= 1
        if self._depth == 0:
            self._commit()

    def _commit(self) -> None:
        self.session.commit()
        events, self._events = self._events, []
        deletions, self._files_to_delete = self._files_to_delete, []
        hooks, self._after_commit = self._after_commit, []
        self._files_written.clear()
        for key in deletions:
            self.storage.delete(key)
        for hook in hooks:
            try:
                hook()
            except Exception:  # noqa: BLE001 - a follow-up must never fail the request
                logger.exception("After-commit hook failed")
        for event in events + self._events:
            self.publisher.publish(event)
        self._events.clear()

    def _rollback(self) -> None:
        self.session.rollback()
        for key in self._files_written:
            self.storage.delete(key)
        self._files_written.clear()
        self._files_to_delete.clear()
        self._events.clear()
        self._after_commit.clear()
        self.stock_touched.clear()

    # ── queued side effects ──
    def emit(self, event: Event) -> None:
        """Publish ``event`` once (and only if) the transaction commits."""
        if self._depth == 0:
            self.publisher.publish(event)
        else:
            self._events.append(event)

    def after_commit(self, hook: Callable[[], None]) -> None:
        self._after_commit.append(hook)

    def file_written(self, key: str) -> None:
        self._files_written.append(key)

    def delete_file_on_commit(self, key: str) -> None:
        self._files_to_delete.append(key)
