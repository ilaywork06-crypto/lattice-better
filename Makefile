.PHONY: help up down clean logs sync dev-core dev-notify dev-web demo test test-pg lint web-check check migration

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up:  ## Build and start the whole stack → http://localhost:8080
	docker compose up --build -d

down:  ## Stop the stack
	docker compose down

clean:  ## Stop the stack and delete its data
	docker compose down -v

logs:  ## Follow the logs
	docker compose logs -f

sync:  ## Install the Python workspace and the web app's packages
	uv sync --all-packages
	cd frontend && npm install

dev-core:  ## Run the core API locally (SQLite) on :8000
	uv run uvicorn lattice_core.main:app_factory --factory --reload --port 8000

dev-notify:  ## Run the notification service locally on :8001
	uv run uvicorn lattice_notifications.main:app_factory --factory --reload --port 8001

dev-web:  ## Run the web app with hot reload on :5173 (proxies /api)
	cd frontend && npm run dev

demo:  ## Fill an empty Lattice with a demo world (API on :8000)
	uv run python scripts/seed_demo.py

test:  ## Backend tests (SQLite)
	uv run pytest services

test-pg:  ## Core API tests on PostgreSQL (set LATTICE_TEST_POSTGRES_URL)
	uv run pytest services/core-api/tests

lint:  ## Lint the Python code
	uv run ruff check services packages scripts

web-check:  ## Typecheck, check translations and build the web app
	cd frontend && npm run typecheck && node --experimental-strip-types scripts/check-i18n.mjs && npm run build

check: lint test web-check  ## Everything CI runs

migration:  ## Create a migration after changing the models: make migration m="what changed"
	uv run alembic -c services/core-api/alembic.ini revision --autogenerate -m "$(m)"
