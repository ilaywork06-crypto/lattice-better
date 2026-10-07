from fastapi import APIRouter, status

from lattice_core.api.deps import Svc
from lattice_core.domain.enums import CatalogCategory
from lattice_core.schemas.catalog import (
    CatalogLinksUpdate,
    CatalogOptionCreate,
    CatalogOptionOut,
    CatalogOptionUpdate,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("", response_model=list[CatalogOptionOut])
def list_options(s: Svc, category: CatalogCategory | None = None, active_only: bool = False):
    return s.catalog.list(category, active_only)


@router.post("", response_model=CatalogOptionOut, status_code=status.HTTP_201_CREATED)
def create_option(body: CatalogOptionCreate, s: Svc):
    return s.catalog.view(s.catalog.create(body))


@router.patch("/{option_id}", response_model=CatalogOptionOut)
def update_option(option_id: int, body: CatalogOptionUpdate, s: Svc):
    return s.catalog.view(s.catalog.update(option_id, body))


@router.put("/{option_id}/links", response_model=CatalogOptionOut,
            summary="Set this value's links to one other category (two-way)")
def set_links(option_id: int, body: CatalogLinksUpdate, s: Svc):
    return s.catalog.view(s.catalog.set_links(option_id, body))


@router.delete("/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_option(option_id: int, s: Svc) -> None:
    s.catalog.delete(option_id)
