from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer

from lattice_core.services.base import Services
from lattice_core.services.uow import UnitOfWork

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def get_uow(request: Request) -> Iterator[UnitOfWork]:
    state = request.app.state
    session = state.session_factory()
    try:
        yield UnitOfWork(session, state.publisher, state.storage)
    finally:
        session.close()


def get_public_services(request: Request, uow: UnitOfWork = Depends(get_uow)) -> Services:
    """Services with no signed-in user (sign-in itself)."""
    return Services(uow, request.app.state.settings)


def get_services(
    request: Request,
    token: str = Depends(oauth2),
    uow: UnitOfWork = Depends(get_uow),
) -> Services:
    services = Services(uow, request.app.state.settings)
    services.actor = services.auth.user_from_token(token)
    return services


Svc = Annotated[Services, Depends(get_services)]
PublicSvc = Annotated[Services, Depends(get_public_services)]
