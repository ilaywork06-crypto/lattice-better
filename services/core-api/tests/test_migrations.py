from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from lattice_core.db import models  # noqa: F401
from lattice_core.db.base import Base


def test_migrations_match_the_models(world):
    """A model change without a migration fails here, not in production."""
    engine = world.client.app.state.engine
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn, opts={"compare_type": True})
        diff = compare_metadata(ctx, Base.metadata)
    assert diff == []
