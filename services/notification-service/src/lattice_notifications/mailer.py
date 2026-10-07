"""Outbound email. Failures are the caller's to log — a dead SMTP server never
stops notifications from being stored."""

from __future__ import annotations

import logging
from email.message import EmailMessage
from typing import Protocol

import aiosmtplib

from lattice_notifications.settings import Settings

logger = logging.getLogger("lattice_notifications.mailer")


class Mailer(Protocol):
    async def send(self, to: str, subject: str, body: str) -> None: ...


class SmtpMailer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send(self, to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = self.settings.smtp_from
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)
        await aiosmtplib.send(
            message,
            hostname=self.settings.smtp_host,
            port=self.settings.smtp_port,
            use_tls=self.settings.smtp_use_tls,
            start_tls=False,
            timeout=10,
        )


class LogMailer:
    async def send(self, to: str, subject: str, body: str) -> None:
        logger.info("(email not sent — no SMTP host) to=%s subject=%s", to, subject)


class RecordingMailer:
    """Keeps every email — for tests."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []

    async def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject, body))
