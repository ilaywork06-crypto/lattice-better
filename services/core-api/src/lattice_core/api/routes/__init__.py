from fastapi import APIRouter

from lattice_core.api.routes import (
    audit,
    auth,
    catalog,
    documents,
    field_groups,
    graph,
    inventory,
    items,
    locations,
    search,
    spreadsheets,
    templates,
    users,
    workflow,
)

api_router = APIRouter(prefix="/api/v1")
for module in (auth, users, catalog, locations, templates, field_groups, items, documents,
               workflow, inventory, graph, search, audit, spreadsheets):
    api_router.include_router(module.router)
