"""Locations, the desiccator (a set of locations) and the floor-plan buildings."""

from __future__ import annotations

from lattice_core.db.models import Location, MapBuilding
from lattice_core.domain.enums import FieldType
from lattice_core.domain.errors import Conflict, PermissionDenied, RuleViolation
from lattice_core.domain.permissions import Permission, has_permission
from lattice_core.schemas.locations import (
    BuildingIn,
    BuildingUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
)
from lattice_core.services.base import Service
from lattice_core.services.references import forget_reference


class LocationService(Service):
    # ── locations ──
    def list(self) -> list[LocationOut]:
        self.services.require(Permission.READ)
        counts = self.uow.locations.item_counts()
        return [self._out(loc, counts.get(loc.id, 0)) for loc in self.uow.locations.list()]

    def view(self, loc: Location) -> LocationOut:
        return self._out(loc, self.uow.locations.item_count(loc.id))

    @staticmethod
    def _out(loc: Location, count: int) -> LocationOut:
        out = LocationOut.model_validate(loc)
        out.item_count = count
        return out

    def _check_name(self, name: str, exclude_id: int | None = None) -> str:
        clean = name.strip()
        clash = self.uow.locations.by_name(clean)
        if clash is not None and clash.id != exclude_id:
            raise Conflict(f"A location named '{clash.name}' already exists")
        return clean

    def _may_define_desiccator(self) -> None:
        if not has_permission(self.actor.role, Permission.MANAGE_DESICCATOR):
            raise PermissionDenied("Only managers decide which locations form the desiccator")

    def create(self, cmd: LocationCreate) -> Location:
        self.services.require(Permission.WRITE_LOCATIONS)
        with self.uow.transaction():
            if cmd.is_desiccator:
                self._may_define_desiccator()
            loc = self.uow.locations.add(Location(**{**cmd.model_dump(),
                                                     "name": self._check_name(cmd.name)}))
            self.uow.session.flush()
            return loc

    def update(self, location_id: int, cmd: LocationUpdate) -> Location:
        self.services.require(Permission.WRITE_LOCATIONS)
        with self.uow.transaction():
            loc = self.uow.locations.require(location_id)
            data = cmd.model_dump(exclude_unset=True)
            if data.get("name") is not None:
                data["name"] = self._check_name(data["name"], loc.id)
            if "is_desiccator" in data and data["is_desiccator"] is not None \
                    and data["is_desiccator"] != loc.is_desiccator:
                self._may_define_desiccator()
                self._desiccator_changed()
            for key, value in data.items():
                if value is None and key in ("name", "x", "y", "is_desiccator"):
                    continue
                setattr(loc, key, value)
            return loc

    def delete(self, location_id: int) -> None:
        self.services.require(Permission.DELETE_LOCATIONS)
        with self.uow.transaction():
            loc = self.uow.locations.require(location_id)
            count = self.uow.locations.item_count(loc.id)
            if count:
                raise Conflict(f"{count} item(s) are at '{loc.name}' — move them before "
                               "deleting it")
            forget_reference(self.uow, {FieldType.LOCATION}, loc.id)
            self.uow.locations.delete(loc)

    def set_desiccator(self, location_ids: list[int]) -> list[LocationOut]:
        """Define the complete set of locations that make up the desiccator."""
        self.services.require(Permission.MANAGE_DESICCATOR)
        with self.uow.transaction():
            wanted = set(location_ids)
            locations = self.uow.locations.list()
            unknown = wanted - {loc.id for loc in locations}
            if unknown:
                raise RuleViolation(f"Unknown locations: {sorted(unknown)}")
            before = sorted(loc.id for loc in locations if loc.is_desiccator)
            for loc in locations:
                loc.is_desiccator = loc.id in wanted
            if before != sorted(wanted):
                self._desiccator_changed()
                self.audit.record(
                    "desiccator.update",
                    f"The desiccator now has {len(wanted)} location(s)",
                    details={"before": before, "after": sorted(wanted)},
                )
        return self.list()

    def _desiccator_changed(self) -> None:
        # Redefining the desiccator reclassifies every card template's stock.
        self.services.inventory.track_templates({t.id for t in self.uow.stock.card_templates()})

    # ── floor-plan buildings ──
    def buildings(self) -> list[MapBuilding]:
        self.services.require(Permission.READ)
        return self.uow.buildings.list()

    def create_building(self, cmd: BuildingIn) -> MapBuilding:
        self.services.require(Permission.WRITE_MAP)
        with self.uow.transaction():
            b = self.uow.buildings.add(MapBuilding(**cmd.model_dump()))
            self.uow.session.flush()
            return b

    def update_building(self, building_id: int, cmd: BuildingUpdate) -> MapBuilding:
        self.services.require(Permission.WRITE_MAP)
        with self.uow.transaction():
            b = self.uow.buildings.require(building_id)
            for key, value in cmd.model_dump(exclude_unset=True).items():
                setattr(b, key, value)
            return b

    def delete_building(self, building_id: int) -> None:
        self.services.require(Permission.DELETE_MAP)
        with self.uow.transaction():
            self.uow.buildings.delete(self.uow.buildings.require(building_id))
