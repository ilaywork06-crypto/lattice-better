"""Application factory: wires settings, persistence, storage and the event bus
into the FastAPI app. Everything is injected, so tests build the same app with
an in-memory publisher and a temporary database."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from lattice_core import __version__
from lattice_core.api.errors import install_error_handlers
from lattice_core.api.routes import api_router
from lattice_core.bootstrap import bootstrap
from lattice_core.db.session import make_engine, make_session_factory
from lattice_core.infra.events import EventPublisher, NullPublisher, RedisPublisher
from lattice_core.infra.storage import FileStorage, LocalFileStorage
from lattice_core.settings import Settings, get_settings
from lattice_shared.logging import configure_logging

logger = configure_logging("lattice_core")


def create_app(
    settings: Settings | None = None,
    *,
    publisher: EventPublisher | None = None,
    storage: FileStorage | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    engine = make_engine(settings.database_url)
    session_factory = make_session_factory(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        bootstrap(engine, session_factory, settings)
        logger.info("Lattice core API %s ready", __version__)
        yield
        engine.dispose()

    app = FastAPI(
        title="Lattice — Core API",
        version=__version__,
        description="Hierarchical hardware asset tracking: setups, assemblies and cards, "
                    "each made from a template.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.publisher = publisher or (
        RedisPublisher(settings.redis_url) if settings.redis_url else NullPublisher()
    )
    app.state.storage = storage or LocalFileStorage(settings.upload_dir)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
    install_error_handlers(app)
    app.include_router(api_router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok", "service": "core-api", "version": __version__}

    return app


def app_factory() -> FastAPI:  # pragma: no cover - uvicorn entry point
    return create_app()
