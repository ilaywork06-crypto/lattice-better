"""Engine and session factory."""

from __future__ import annotations

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker


def make_engine(url: str) -> Engine:
    is_sqlite = url.startswith("sqlite")
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False} if is_sqlite else {},
        pool_pre_ping=True,
    )
    if is_sqlite:
        # SQLite ignores foreign keys (and ON DELETE rules) unless asked per
        # connection — without this the dev database would drift from Postgres.
        @event.listens_for(engine, "connect")
        def _on_connect(dbapi_connection, _record):  # pragma: no cover - trivial
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
            # Let SQLAlchemy, not the driver, decide when transactions begin —
            # pysqlite's own handling breaks SAVEPOINTs (nested transactions).
            dbapi_connection.isolation_level = None

        @event.listens_for(engine, "begin")
        def _on_begin(connection):  # pragma: no cover - trivial
            connection.exec_driver_sql("BEGIN")

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False)
