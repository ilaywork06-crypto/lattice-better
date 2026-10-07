from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    notify_database_url: str = "sqlite:///./lattice_notify.sqlite3"
    # Empty → don't consume events (useful for local runs without Redis).
    redis_url: str = "redis://localhost:6379/0"

    # Must match the core API so both validate the same tokens.
    jwt_secret: str = "dev-insecure-secret-change-me-please-32b+"
    jwt_algorithm: str = "HS256"

    # Empty host → emails are logged, not sent.
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_from: str = "lattice@lattice.io"
    smtp_use_tls: bool = False

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
