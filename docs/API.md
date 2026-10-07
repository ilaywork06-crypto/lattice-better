# API reference

Everything is under **`/api/v1`**. The live, typed reference is each service's OpenAPI page (`:8000/docs`, `:8001/docs`); this page explains the conventions and lists the endpoints.

## Conventions

**Auth.** `POST /auth/token` (OAuth2 password form: `username` = email, `password`) returns `{ access_token, token_type, user }`, where `user` includes `permissions[]` and `proposable_actions[]`. Send `Authorization: Bearer <token>` on every other request. Both services accept the same token.

**Lists** that can grow are paged: `?limit=&offset=` → `{ items, total, limit, offset }`.

**Errors** always have one shape:

```json
{ "error": { "code": "…", "message": "a sentence for people", "issues": [ … ] } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `rule_violation` | A domain rule says no ("a linked item has no location of its own") |
| 400 | `validation_failed` | Values are invalid; `issues[]` lists **every** one (`field`, `label`, `message`; spreadsheet cells add `sheet`, `cell`, `row`, `column`) |
| 401 | `unauthenticated` | Missing, invalid or expired token |
| 403 | `forbidden` | The role lacks the permission |
| 404 | `not_found` | |
| 409 | `conflict` | Duplicate name/serial/email, or something still depends on it |
| 422 | `invalid_request` | The request doesn't match the schema |

**Permissions** (see `GET /auth/me`): `read`, `propose_changes`, `review_changes`, `write_items`, `write_templates`, `write_field_groups`, `stage_uploads`, `write_locations`, `delete_locations`, `manage_desiccator`, `write_map`, `delete_map`, `write_thresholds`, `delete_thresholds`, `manage_catalog`, `manage_users`, `import_data`.

## Core API

### Auth & users
| | |
|---|---|
| `POST /auth/token` | Sign in |
| `GET /auth/me` | The signed-in user, their permissions and proposable actions |
| `GET /auth/login-hints` | **Unauthenticated.** Sign-in shortcuts a manager published (email, and a password only if published) |
| `GET /users` · `POST /users` · `PATCH /users/{id}` · `DELETE /users/{id}` | Users. `login_hint_password: ""` stops publishing a password. A user with proposals can only be deactivated |

### Catalog, locations, map
| | |
|---|---|
| `GET /catalog?category=&active_only=` | Values with `usage_count` and `linked_ids` |
| `POST /catalog` · `PATCH /catalog/{id}` · `DELETE /catalog/{id}` | Items hold the id, so a rename needs no cascade; a used value can't be deleted |
| `PUT /catalog/{id}/links` `{category, option_ids}` | This value's links to one other category, as the end state (links are two-way) |
| `GET /locations` · `POST` · `PATCH /locations/{id}` · `DELETE` | Locations (x, y in 0..100) with `item_count` |
| `PUT /locations/desiccator` `{location_ids}` | The complete set of desiccator locations |
| `GET /map/buildings` · `POST` · `PATCH /map/buildings/{id}` · `DELETE` | Buildings drawn on the floor plan |

### Templates & field groups
| | |
|---|---|
| `GET /templates?type=&card_type=&search=` | Summaries with unit `counts` per state (`total` excludes destroyed) |
| `GET /templates/{id}` | Detail: `fields[]` (with readable `fixed_display` / `options_display` and shared `files`), `children[]` (template + `min_count`/`max_count`), `parents[]`, `next_serial` |
| `POST /templates` | `TemplateCreate { type, name, card_type?, serial_prefix, description?, fields[], children[], source_template_id? }` |
| `PATCH /templates/{id}` | Any of those but `type`. `fields` and `children` are the **complete** lists after the edit (`id` marks an existing field). Changes reach every item |
| `DELETE /templates/{id}` | Only while nothing was made from it |
| `POST /templates/{id}/fields/{field_id}/files` · `DELETE /templates/{id}/files/{doc_id}` | Files of a fixed *files* field |
| `GET/POST /field-groups` · `GET/PATCH/DELETE /field-groups/{id}` | Reusable field sets; `?search=` matches group and field names |

A field: `{ id?, key?, label, field_type, mode: fixed|choice|item, required, config: {options?, pattern?, min_length?}, fixed_value?, copy_files_from? }`.

### Items
| | |
|---|---|
| `GET /items` | Paged rows. Filters: `type, template_id, state, card_type, storage, location_id, parent_id, top_level, include_destroyed, fits_in_template, holds_template, q` |
| `GET /items/{id}` | Detail: every field with its effective `value` and readable `display`, `ancestors[]`, `children[]`, `composition[]`, `is_complete`, `state_history[]`, `documents[]`, `extras[]` |
| `GET /items/{id}/tree?ancestors=` | The item's tree as a graph |
| `POST /items` | `ItemCreate { template_id, values{key: value}, serial?, child_ids[] }` |
| `PATCH /items/{id}` | `ItemUpdate { values (changed only), serial? }` — location, container and state have their own actions |
| `DELETE /items/{id}` | Its contents are taken out, not deleted |
| `POST /items/{id}/move` `{location_id, note?}` | Everything inside follows |
| `POST /items/{id}/link` `{parent_id}` | Place inside a container (type, template and capacity rules) |
| `POST /items/{id}/unlink` `{location_id?}` | Take out; stays at the container's location unless told otherwise |
| `PUT /items/{id}/children` `{child_ids}` | The contents, as the end state — validated as a whole |
| `POST /items/{id}/state` `{state, note?}` | A note is required into or out of `faulty` |
| `POST /items/bulk` `{action, item_ids, location_id?, parent_id?, state?, note?}` | One action on many items — all or none |
| `POST /items/{id}/documents` (multipart) · `POST /items/{id}/links` · `DELETE /items/{id}/documents/{doc_id}` | Documents |
| `POST /items/{id}/extras` · `DELETE /items/{id}/extras/{extra_id}` | A setup's extra items |
| `POST /uploads` (multipart) | Stage a file before its item exists; put the returned id in a *files* field's value |
| `GET /documents/{id}/download` | The file (authenticated) |

### Change requests
| | |
|---|---|
| `POST /change-requests` | `{ action, item_id?, template_id?, payload, reason }` — the payload is validated **now** |
| `GET /change-requests?status=&mine=` · `GET /change-requests/{id}` | |
| `POST /change-requests/{id}/approve` `{note?}` | Runs the change as the reviewer, in one transaction |
| `POST /change-requests/{id}/reject` `{note?}` | |

| `action` | targets | `payload` |
|---|---|---|
| `create` | — | `ItemCreate` |
| `update` | `item_id` | `ItemUpdate` |
| `delete` | `item_id` | `{}` |
| `move` | `item_id` | `{ location_id, note? }` |
| `link` | `item_id` | `{ parent_id }` |
| `unlink` | `item_id` | `{ location_id? }` |
| `state_change` | `item_id` | `{ state, note? }` |
| `template_create` | — | `TemplateCreate` |
| `template_update` | `template_id` | `TemplateUpdate` |

Viewers may propose `move` only.

### Inventory, graphs, search, audit, spreadsheets
| | |
|---|---|
| `GET /inventory/summary` | Dashboard figures |
| `GET /inventory/stock?card_type=&in_desiccator=` | Per card template: `total, available, desiccator, in_use, assembled, assembled_in_desiccator, faulty, available_serials, min_quantity, is_low` |
| `GET /inventory/thresholds?low_only=` | |
| `PUT /inventory/thresholds/{template_id}` `{min_quantity, notify_email?}` · `DELETE` | |
| `GET /graph/templates?root_template_id=` · `GET /graph/items?template_id=` | Graphs `{nodes, edges, roots, focus}` |
| `GET /search?q=` | Items, templates, locations (and users, for user managers), ranked |
| `GET /audit?item_id=&template_id=&period=&mine=&action=&q=` · `GET /audit/export?…` | `period`: `day|week|month|half_year|year|all`; `mine`: only items I manage or am responsible for |
| `GET /spreadsheets/import-template?template_id=&type=` | Workbook: one sheet per template, headers = its creation fields |
| `POST /spreadsheets/import` (multipart) | All or nothing; a failure is a `validation_failed` with one issue per bad cell |
| `GET /spreadsheets/export?template_id=&type=` | Every item, readable values |

## Notification service

| | |
|---|---|
| `GET /notifications?filter=all|unread|read&limit=&offset=` | Paged, newest first |
| `GET /notifications/counts` | `{ total, unread, read }` |
| `PUT /notifications/{id}/read` `{read?: true}` | Mark read (or unread) |
| `POST /notifications/read-all` | |

## Events (Redis channel `lattice:events`)

```
Event { id, type, created_at, title, body, link, recipients: [{user_id?, email?}], payload }
```

`type`: `change_request.submitted` (to the item's managers, or all managers), `change_request.approved` / `.rejected` (to the proposer), `inventory.low_stock` (one digest per recipient; `payload.components[] = {template_id, name, card_type, available, min_quantity, shortfall, link}`).
