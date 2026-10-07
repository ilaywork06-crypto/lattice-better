"""One error shape for the whole API.

    { "error": { "code": "validation_failed", "message": "…", "issues": [ … ] } }

``code`` is stable and machine-readable; ``message`` is a sentence for people;
``issues`` (optional) pins each problem to a field, a payload key or a
spreadsheet cell so a form can mark every one of them.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from lattice_core.domain.errors import LatticeError

logger = logging.getLogger("lattice_core.api")


def _body(code: str, message: str, issues: list[dict] | None = None) -> dict:
    error: dict = {"code": code, "message": message}
    if issues:
        error["issues"] = issues
    return {"error": error}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(LatticeError)
    async def lattice_error(_: Request, exc: LatticeError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status == 401 else None
        return JSONResponse(
            status_code=exc.status,
            content=_body(exc.code, exc.message, [i.as_dict() for i in exc.issues]),
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def request_invalid(_: Request, exc: RequestValidationError):
        issues = []
        for e in exc.errors():
            loc = [str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path")]
            issues.append({"field": ".".join(loc) or None, "message": e.get("msg", "invalid")})
        message = "; ".join(f"{i['field']}: {i['message']}" if i["field"] else i["message"]
                            for i in issues)
        return JSONResponse(status_code=422, content=_body("invalid_request", message, issues))

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        codes = {401: "unauthenticated", 403: "forbidden", 404: "not_found",
                 405: "method_not_allowed"}
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(codes.get(exc.status_code, "http_error"), str(exc.detail)),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(_: Request, exc: IntegrityError):
        # Services check first so people get a sentence; this is the safety net
        # for a race between two requests.
        logger.warning("Integrity error: %s", exc.orig)
        return JSONResponse(
            status_code=409,
            content=_body("conflict", "That clashes with a change made at the same time — "
                                      "reload and try again"),
        )
