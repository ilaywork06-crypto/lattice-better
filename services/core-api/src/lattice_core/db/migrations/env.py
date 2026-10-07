"""Alembic environment. Runs on a connection handed in by the app (bootstrap)
or, from the command line, on ``DATABASE_URL``."""

from alembic import context
from sqlalchemy import create_engine

from lattice_core.db import models  # noqa: F401 - registers every table
from lattice_core.db.base import Base

config = context.config
target_metadata = Base.metadata


def _configure_and_run(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=connection.dialect.name == "sqlite",
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _configure_and_run(connection)
        return
    from lattice_core.settings import get_settings

    url = config.get_main_option("sqlalchemy.url") or get_settings().database_url
    engine = create_engine(url)
    with engine.begin() as conn:
        _configure_and_run(conn)


if context.is_offline_mode():  # pragma: no cover
    raise SystemExit("Offline migrations are not supported; run against a database.")
run()
