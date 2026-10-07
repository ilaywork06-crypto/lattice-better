"""Runtime configuration from the environment (or a ``.env`` file)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # A local SQLite file by default, so the API boots with no database server.
    database_url: str = "sqlite:///./lattice_core.sqlite3"
    # Empty → events are dropped (useful for local runs without Redis).
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "dev-insecure-secret-change-me-please-32b+"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    # The only account created automatically: a fresh system ships empty.
    bootstrap_admin_email: str = "admin@lattice.io"
    bootstrap_admin_password: str = "admin1234"

    upload_dir: str = "./uploads"
    max_upload_mb: int = 50
    staged_upload_ttl_days: int = 14

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
