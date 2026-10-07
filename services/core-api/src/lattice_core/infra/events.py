"""Publishing domain events to the bus.

Publishing is best-effort and never blocks or breaks a request: events are
handed to a background thread that writes them to Redis. A dead Redis costs a
notification, not an API call.
"""

from __future__ import annotations

import logging
import queue
import threading
from typing import Protocol

from lattice_shared.events import CHANNEL, Event

logger = logging.getLogger("lattice_core.events")


class EventPublisher(Protocol):
    def publish(self, event: Event) -> None: ...


class NullPublisher:
    def publish(self, event: Event) -> None:  # pragma: no cover - trivial
        logger.debug("Dropping event %s (no event bus configured)", event.type)


class InMemoryPublisher:
    """Keeps every event — used by the tests to assert on notifications."""

    def __init__(self) -> None:
        self.events: list[Event] = []

    def publish(self, event: Event) -> None:
        self.events.append(event)

    def of_type(self, event_type: str) -> list[Event]:
        return [e for e in self.events if e.type == event_type]

    def clear(self) -> None:
        self.events.clear()


class RedisPublisher:
    def __init__(self, url: str) -> None:
        import redis

        self._redis = redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        self._queue: queue.Queue[Event] = queue.Queue(maxsize=10_000)
        self._thread = threading.Thread(target=self._run, name="event-publisher", daemon=True)
        self._thread.start()

    def publish(self, event: Event) -> None:
        try:
            self._queue.put_nowait(event)
        except queue.Full:  # pragma: no cover - only under a long outage
            logger.warning("Event queue full; dropping %s", event.type)

    def _run(self) -> None:  # pragma: no cover - exercised in deployment
        while True:
            event = self._queue.get()
            try:
                self._redis.publish(CHANNEL, event.to_wire())
            except Exception as exc:  # noqa: BLE001 - best effort side channel
                logger.warning("Could not publish %s: %s", event.type, exc)
