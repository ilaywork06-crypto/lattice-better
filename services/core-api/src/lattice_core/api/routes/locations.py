from fastapi import APIRouter, status

from lattice_core.api.deps import Svc
from lattice_core.schemas.locations import (
    BuildingIn,
    BuildingOut,
    BuildingUpdate,
    DesiccatorUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
)

router = APIRouter(tags=["locations"])


@router.get("/locations", response_model=list[LocationOut])
def list_locations(s: Svc):
    return s.locations.list()


@router.post("/locations", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(body: LocationCreate, s: Svc):
    return s.locations.view(s.locations.create(body))


@router.put("/locations/desiccator", response_model=list[LocationOut],
            summary="Set the complete set of desiccator locations")
def set_desiccator(body: DesiccatorUpdate, s: Svc):
    return s.locations.set_desiccator(body.location_ids)


@router.patch("/locations/{location_id}", response_model=LocationOut)
def update_location(location_id: int, body: LocationUpdate, s: Svc):
    return s.locations.view(s.locations.update(location_id, body))


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(location_id: int, s: Svc) -> None:
    s.locations.delete(location_id)


@router.get("/map/buildings", response_model=list[BuildingOut])
def list_buildings(s: Svc):
    return s.locations.buildings()


@router.post("/map/buildings", response_model=BuildingOut, status_code=status.HTTP_201_CREATED)
def create_building(body: BuildingIn, s: Svc):
    return s.locations.create_building(body)


@router.patch("/map/buildings/{building_id}", response_model=BuildingOut)
def update_building(building_id: int, body: BuildingUpdate, s: Svc):
    return s.locations.update_building(building_id, body)


@router.delete("/map/buildings/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_building(building_id: int, s: Svc) -> None:
    s.locations.delete_building(building_id)
