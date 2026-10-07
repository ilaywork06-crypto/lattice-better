"""Turns events from the bus into stored notifications and emails.

``handle`` is the whole job for one event and is what the tests drive;
``run_consumer`` subscribes to Redis for the app's lifetime and reconnects with
exponential backoff, so a Redis outage delays notifications but never kills
the service.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging

from sqlalchemy.orm import sessionmaker

from lattice_notifications.mailer import Mailer
from lattice_notifications.service import NotificationService
from lattice_shared.events import CHANNEL, Event

logger = logging.getLogger("lattice_notifications.consumer")


class EventHandler:
    def __init__(self, session_factory: sessionmaker, mailer: Mailer) -> None:
        self.session_factory = session_factory
        self.mailer = mailer

    def _store(self, event: Event) -> int:
        with self.session_factory() as session:
            return NotificationService(session).store(event)

    async def handle(self, event: Event) -> None:
        stored = await asyncio.to_thread(self._store, event)
        logger.info("Event %s (%s): %d notification(s)", event.id, event.type, stored)
        for address in dict.fromkeys(r.email for r in event.recipients if r.email):
            try:
                await self.mailer.send(address, event.title, event.body)
            except Exception:  # noqa: BLE001
                logger.exception("Could not email %s about %s", address, event.id)


async def run_consumer(redis_url: str, handler: EventHandler) -> None:  # pragma: no cover
    import redis.asyncio as aioredis

    backoff = 1.0
    while True:
        client = aioredis.from_url(redis_url, decode_responses=True)
        pubsub = client.pubsub()
        try:
            await pubsub.subscribe(CHANNEL)
            logger.info("Listening for events on %s", CHANNEL)
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                backoff = 1.0
                try:
                    await handler.handle(Event.from_wire(message["data"]))
                except Exception:  # noqa: BLE001 - one bad event never stops the loop
                    logger.exception("Could not handle an event")
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.warning("Lost the event bus; reconnecting in %.0fs", backoff, exc_info=True)
        finally:
            with contextlib.suppress(Exception):
                await pubsub.aclose()
                await client.aclose()
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 30.0)
