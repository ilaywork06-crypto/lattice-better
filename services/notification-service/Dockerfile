# Build context: the repository root (see docker-compose.yml).
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONUNBUFFERED=1 UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY packages ./packages
COPY services ./services
RUN uv sync --frozen --no-dev --package lattice-notifications

EXPOSE 8001
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"
CMD ["uv", "run", "--frozen", "--no-dev", "--package", "lattice-notifications", \
     "uvicorn", "lattice_notifications.main:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers"]
