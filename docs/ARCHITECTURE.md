# Architecture

Lattice is two small services and a single-page app:

* **core-api** owns the domain — templates, items, the hierarchy, stock, the approval workflow, the audit log — and publishes domain events.
* **notification-service** turns those events into in-app notifications and emails.
* **web** is a React SPA served by nginx, which also proxies `/api` to both services, so the browser talks to one origin.

Both services validate the same JWT (shared `JWT_SECRET`). The event contract lives in `packages/lattice-shared`, imported by both sides, so the wire format is defined once.

---

## Core API: layers

```
api/            HTTP: routes, dependencies, error handlers        (FastAPI lives only here)
  │  builds a command, calls one use case, presents the result
services/       use cases, the Unit of Work, the audit trail      (the application layer)
  │  enforce rules, write through repositories
repositories/   every SQL query                                   (SQLAlchemy 2.0 select())
db/             ORM models, engine/session, Alembic migrations
domain/         vocabulary, pure rules, errors, permissions       (no I/O, no frameworks)
```

Dependencies point downward only; `domain` depends on nothing. Two side packages:

* `schemas/` — Pydantic **commands** (inputs) and **views** (outputs): the API contract, shared by services and routes.
* `views/` — presenters that turn ORM rows into view models (resolving ids into names so the UI never needs a lookup to render an item).
* `infra/` — adapters: password hashing and JWTs, file storage, the event publisher. Each is behind a small protocol, so tests inject an in-memory publisher and a temp directory.

### A request, end to end

`POST /api/v1/items/{id}/move` →

1. **Route** (`api/routes/items.py`) — FastAPI parses the body into a `MoveCommand`; the `Svc` dependency opens a session, wraps it in a **Unit of Work**, resolves the user from the token and hands over a `Services` container.
2. **Use case** (`services/hierarchy.py: HierarchyService.move`) — checks the permission (`write_items`), opens `uow.transaction()`, loads the item through the repository, applies the rule (*a linked item has no location of its own*), cascades the new location to every descendant, notes which card templates' stock may have changed, and records an audit entry.
3. **Commit** — the outermost `transaction()` block commits once. Then, and only then: queued events are published, files queued for deletion are removed, and after-commit hooks run (here: the low-stock check for the touched templates, which may emit an alert event).
4. **Presenter** (`views/items.py: item_detail`) — builds the `ItemDetail` view the route returns.

If anything raises, the transaction rolls back, queued events and hooks are dropped, and files written during the transaction are deleted — storage never drifts from the database.

### The Unit of Work

`services/uow.py`. One per request. It owns the session, every repository, and three queues: events to publish, files to delete, hooks to run after commit. `transaction()` is **re-entrant** — only the outermost block commits — so use cases call each other freely:

* approving a change request runs `ItemService.create` (or any other use case) inside the approval's transaction, as the reviewer;
* a bulk action runs N moves in one transaction — all succeed or none do;
* the Excel import runs every row through `ItemService.create` inside nested savepoints, then raises (rolling everything back) if any cell was wrong.

### Use cases

`services/base.py: Services` lazily builds each service for one actor and one Unit of Work. A service method is one use case:

| Service | Use cases |
|---|---|
| `TemplateService` | create (incl. duplicating shared files), update (propagating to items), delete |
| `ItemService` | create from a template, update own values/serial, change state, delete, bulk, extras |
| `HierarchyService` | move (cascade), link/place, unlink/take out, set contents — and the capacity rules |
| `WorkflowService` | submit, approve, reject proposals — driven by the `ACTIONS` table |
| `InventoryService` | stock per template, thresholds, summary, low-stock alerts |
| `DocumentService` | staged uploads, item/template files, copying, downloads |
| `CatalogService`, `LocationService`, `UserService`, `FieldGroupService`, `GraphService`, `SearchService`, `SpreadsheetService`, `AuditLogService`, `AuthService` | … |

**The change-request table.** `services/workflow.py: ACTIONS` describes each proposable action once: the command its payload must be, what it targets (item, template, nothing), how to word it, and which use case applies it. Submitting validates the payload against that command immediately, so a malformed proposal never reaches a manager; approving re-parses it and calls the same use case a manager would.

### Field values

A field's value lives in one of three places — on the template (fixed fields), in a real column of the item (system types: catalog values, people, location, parent, state, quantity) or in `item_field_values` (the rest). `services/item_values.py` is the only place that knows which.

Input is normalised in two steps: `domain/fields.py: coerce_scalar` handles text, numbers, dates, formats (`XX-#####`); `services/field_values.py: FieldValues` adds the reference types (catalog values, users, locations, items, files), which need a lookup and accept either ids (the UI) or readable text (a spreadsheet cell). Every invalid value is reported at once, each as an `Issue` pinned to its field.

### Permissions

`domain/permissions.py` maps each role to named permissions (`write_items`, `review_changes`, `manage_desiccator`, …) and to the change actions it may *propose*. Use cases check them (`services.require(Permission.X)`); `GET /auth/me` returns them, and the web app uses the same list to decide what to show — the two can't disagree.

| Role | Directly | Proposes |
|---|---|---|
| viewer | read | moves |
| editor | read, stage uploads, locations, map, thresholds | anything |
| manager | everything | — |

### Errors

`domain/errors.py` defines `RuleViolation` (400), `ValidationFailed` (400, with `issues`), `NotFound` (404), `Conflict` (409), `PermissionDenied` (403), `Unauthenticated` (401). The API turns each into one envelope (`api/errors.py`):

```json
{ "error": { "code": "validation_failed", "message": "Band: is required",
             "issues": [{ "field": "band", "label": "Band", "message": "is required" }] } }
```

Request validation (422) and integrity races (409) use the same shape.

### Events and notifications

Use cases call `uow.emit(event)`; events are published after commit by a background thread (`infra/events.py: RedisPublisher`), so a slow or dead Redis never slows or fails a request. The notification service subscribes, stores one row per user recipient (idempotent per event id) and emails every distinct address.

Low-stock alerts are targeted: moves, links, state and quantity changes mark the card templates they touch (`InventoryService.stock_changed`); after commit only those templates' thresholds are checked, and each recipient gets one digest with a structured `payload.components[]`.

### Database

PostgreSQL in production, SQLite for development and tests (with the pragmas that make SQLite honour foreign keys and savepoints). Enums are checked `VARCHAR`s so a vocabulary can change in one migration. Alembic owns the schema and runs on start-up; a test fails if the models and migrations disagree.

Integrity lives in the database (unique serials, unique template names and prefixes per type, ordered catalog-link pairs, `quantity ≥ 1`, card type only on cards, contents limits); services check first so people get a sentence instead of an integrity error. Nothing derived is stored: a card's storage status follows from its parent and its location's `is_desiccator`, so redefining the desiccator reclassifies every card at once.

---

## Web app

```
src/
├── api/
│   ├── generated/      types generated from both services' OpenAPI (npm run gen:api)
│   ├── client.ts       fetch wrapper → typed ApiError (code, message, issues)
│   ├── endpoints.ts    every HTTP call, grouped by resource
│   └── queries.ts      React Query hooks + useAction (mutation, refresh, toast)
├── components/
│   ├── ui/             design system on Radix: button, dialog, menu, select, combobox, tabs, …
│   └── domain/         FieldInput (all 21 field types), pickers, ActionDialog, HierarchyGraph, FloorPlan, badges
├── features/<area>/    pages and dialogs, one folder per area
├── lib/                session & permissions, preferences (theme/accent/language), formatting, domain look
└── i18n/               en.ts, he.ts (+ scripts/check-i18n.mjs)
```

* **Types are generated**, not hand-written: `npm run gen:api` dumps each service's OpenAPI and runs `openapi-typescript`, so a schema change on the server is a type error in the UI.
* **Server state** is React Query only. After any write, active queries refresh — an item move changes stock, counts and the audit log, so the app never shows a stale number.
* **Apply or propose** is one component: `ActionDialog` asks the session whether the user holds the permission (apply directly), may propose the action (adds a *why* field and submits a change request), or neither.
* **RTL**: layouts use logical properties (`ms-`, `pe-`, `start-`), Radix gets the direction from a provider, server-generated text is bidi-isolated, and change descriptions are worded client-side in the UI language.
* **Theming** is CSS variables (`styles/index.css`): light/dark and the colour theme are pure CSS, applied before first paint. Each pastel theme is one hue (`--hue`, plus optional `--tint` / `--primary-l` / `--primary-c`); every surface and accent token is derived from it. *Indigo* and *Classic* override the tokens outright (Indigo with the original pre-pastel values), including the chart colours (`--chart-*`, `--type-*`, `--bar-opacity`).
