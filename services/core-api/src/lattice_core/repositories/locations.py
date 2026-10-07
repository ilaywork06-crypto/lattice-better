from __future__ import annotations

from sqlalchemy import func, or_, select

from lattice_core.db.models import Item, Location, MapBuilding
from lattice_core.repositories.base import Repository, like_pattern


class LocationRepository(Repository[Location]):
    model = Location
    label = "Location"

    def list(self) -> list[Location]:
        return list(self.all(select(Location).order_by(func.lower(Location.name))))

    def by_name(self, name: str) -> Location | None:
        return self.session.scalar(
            select(Location).where(func.lower(func.trim(Location.name)) == name.strip().lower())
        )

    def desiccator(self) -> list[Location]:
        return [loc for loc in self.list() if loc.is_desiccator]

    def first_desiccator(self) -> Location | None:
        locs = self.desiccator()
        return locs[0] if locs else None

    def item_counts(self) -> dict[int, int]:
        rows = self.session.execute(
            select(Item.location_id, func.count(Item.id))
            .where(Item.location_id.is_not(None))
            .group_by(Item.location_id)
        )
        return {location_id: n for location_id, n in rows}

    def item_count(self, location_id: int) -> int:
        return self.count(select(Item.id).where(Item.location_id == location_id))

    def search(self, term: str, limit: int) -> list[Location]:
        like = like_pattern(term)
        stmt = select(Location).where(
            or_(
                Location.name.ilike(like, escape="\\"),
                Location.building.ilike(like, escape="\\"),
                Location.room.ilike(like, escape="\\"),
            )
        ).limit(limit)
        return list(self.all(stmt))


class MapBuildingRepository(Repository[MapBuilding]):
    model = MapBuilding
    label = "Building"

    def list(self) -> list[MapBuilding]:
        return list(self.all(select(MapBuilding).order_by(MapBuilding.sort_order, MapBuilding.id)))
