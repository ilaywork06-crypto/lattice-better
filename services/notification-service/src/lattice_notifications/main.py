"""App factory and HTTP API (``/api/v1/notifications``)."""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Iterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, FastAPI, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from lattice_notifications import __version__
from lattice_notifications.consumer import EventHandler, run_consumer
from lattice_notifications.db import make_session_factory
from lattice_notifications.mailer import LogMailer, Mailer, SmtpMailer
from lattice_notifications.service import NotificationNotFound, NotificationService, ReadFilter
from lattice_notifications.settings import Settings, get_settings
from lattice_shared.logging import configure_logging

logger = configure_logging("lattice_notifications")
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


# ─────────────────────────── schemas ───────────────────────────
class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: str
    title: str
    body: str
    payload: dict | None = None
    link: str | None = None
    read: bool
    created_at: datetime


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    total: int
    limit: int
    offset: int


class CountsOut(BaseModel):
    total: int
    unread: int
    read: int


class ReadState(BaseModel):
    read: bool = True


# ─────────────────────────── dependencies ───────────────────────────
def _error(status_code: int, code: str, message: str) -> HTTPException:
    exc = HTTPException(status_code=status_code, detail=message)
    exc.code = code  # type: ignore[attr-defined]
    return exc


def current_user_id(request: Request, token: str = Depends(oauth2)) -> int:
    s: Settings = request.app.state.settings
    try:
        return int(jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise _error(401, "unauthenticated", "Your session is invalid or has expired") from None


def get_service(request: Request) -> Iterator[NotificationService]:
    session: Session = request.app.state.session_factory()
    try:
        yield NotificationService(session)
    finally:
        session.close()


UserId = Annotated[int, Depends(current_user_id)]
Svc = Annotated[NotificationService, Depends(get_service)]

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=NotificationPage, summary="My notifications, newest first")
def list_notifications(user_id: UserId, svc: Svc, filter: ReadFilter = ReadFilter.ALL,
                       limit: int = Query(30, ge=1, le=200), offset: int = Query(0, ge=0)):
    rows, total = svc.page(user_id, filter, limit, offset)
    return NotificationPage(items=[NotificationOut.model_validate(r) for r in rows], total=total,
                            limit=limit, offset=offset)


@router.get("/counts", response_model=CountsOut)
def counts(user_id: UserId, svc: Svc):
    c = svc.counts(user_id)
    return CountsOut(total=c.total, unread=c.unread, read=c.read)


@router.put("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT,
            summary="Mark one notification read (or unread)")
def mark(notification_id: int, user_id: UserId, svc: Svc, body: ReadState | None = None):
    try:
        svc.mark_read(user_id, notification_id, (body or ReadState()).read)
    except NotificationNotFound:
        raise _error(404, "not_found", "Notification not found") from None


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all(user_id: UserId, svc: Svc) -> None:
    svc.mark_all_read(user_id)


# ─────────────────────────── app ───────────────────────────
def create_app(settings: Settings | None = None, *, mailer: Mailer | None = None,
               consume: bool = True) -> FastAPI:
    settings = settings or get_settings()
    session_factory = make_session_factory(settings.notify_database_url)
    mailer = mailer or (SmtpMailer(settings) if settings.smtp_host else LogMailer())
    handler = EventHandler(session_factory, mailer)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = None
        if consume and settings.redis_url:
            task = asyncio.create_task(run_consumer(settings.redis_url, handler))
        logger.info("Lattice notification service %s ready", __version__)
        yield
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="Lattice — Notification Service", version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.handler = handler
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException):
        code = getattr(exc, "code", None) or {401: "unauthenticated", 404: "not_found"}.get(
            exc.status_code, "http_error")
        return JSONResponse(status_code=exc.status_code,
                            content={"error": {"code": code, "message": str(exc.detail)}})

    app.include_router(router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok", "service": "notification-service", "version": __version__}

    return app


def app_factory() -> FastAPI:  # pragma: no cover - uvicorn entry point
    return create_app()
