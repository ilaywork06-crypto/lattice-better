"""Projects, industries and teams — and the two-way links between them.

Items hold a value's id, so a rename reaches every item with no cascade; a
value in use can't be deleted (deactivate it instead).
"""

from __future__ import annotations

from lattice_core.db.models import CatalogOption
from lattice_core.domain.enums import CATALOG_FIELD_TYPES, CatalogCategory
from lattice_core.domain.errors import Conflict, RuleViolation
from lattice_core.domain.permissions import Permission
from lattice_core.schemas.catalog import (
    CatalogLinksUpdate,
    CatalogOptionCreate,
    CatalogOptionOut,
    CatalogOptionUpdate,
)
from lattice_core.services.base import Service
from lattice_core.services.references import forget_reference, template_names_using

_FIELD_TYPE = {category: ft for ft, category in CATALOG_FIELD_TYPES.items()}


class CatalogService(Service):
    def list(self, category: CatalogCategory | None = None,
             active_only: bool = False) -> list[CatalogOptionOut]:
        self.services.require(Permission.READ)
        links: dict[int, list[int]] = {}
        for a, b in self.uow.catalog.all_links():
            links.setdefault(a, []).append(b)
            links.setdefault(b, []).append(a)
        usage = self.uow.catalog.usage_counts()
        return [
            self._out(o, usage.get(o.id, 0), links.get(o.id, []))
            for o in self.uow.catalog.list(category, active_only)
        ]

    def view(self, option: CatalogOption) -> CatalogOptionOut:
        return self._out(option, self.uow.catalog.usage_count(option),
                         self.uow.catalog.linked_ids(option.id))

    @staticmethod
    def _out(o: CatalogOption, usage: int, linked: list[int]) -> CatalogOptionOut:
        return CatalogOptionOut(
            id=o.id, category=o.category, value=o.value, description=o.description,
            active=o.active, sort_order=o.sort_order, usage_count=usage,
            linked_ids=sorted(linked),
        )

    def create(self, cmd: CatalogOptionCreate) -> CatalogOption:
        self.services.require(Permission.MANAGE_CATALOG)
        with self.uow.transaction():
            value = cmd.value.strip()
            if not value:
                raise RuleViolation("A value cannot be empty")
            if self.uow.catalog.find(cmd.category, value):
                raise Conflict(f"'{value}' already exists among the {cmd.category.value}s")
            option = self.uow.catalog.add(CatalogOption(
                category=cmd.category, value=value, description=cmd.description,
                active=cmd.active, sort_order=cmd.sort_order,
            ))
            self.uow.session.flush()
            return option

    def update(self, option_id: int, cmd: CatalogOptionUpdate) -> CatalogOption:
        self.services.require(Permission.MANAGE_CATALOG)
        with self.uow.transaction():
            option = self.uow.catalog.require(option_id)
            if cmd.value is not None:
                value = cmd.value.strip()
                clash = self.uow.catalog.find(option.category, value)
                if clash is not None and clash.id != option.id:
                    raise Conflict(f"'{value}' already exists")
                option.value = value  # items hold the id: no cascade needed
            if "description" in cmd.model_fields_set:
                option.description = cmd.description
            if cmd.active is not None:
                option.active = cmd.active
            if cmd.sort_order is not None:
                option.sort_order = cmd.sort_order
            return option

    def delete(self, option_id: int) -> None:
        self.services.require(Permission.MANAGE_CATALOG)
        with self.uow.transaction():
            option = self.uow.catalog.require(option_id)
            if self.uow.catalog.usage_count(option):
                raise Conflict("This value is used by items — deactivate it instead of deleting")
            field_type = _FIELD_TYPE[option.category]
            templates = template_names_using(self.uow, field_type, option.id)
            if templates:
                raise Conflict(
                    "This value is used by the template(s) "
                    + ", ".join(f"'{n}'" for n in templates)
                    + " — remove it there first, or deactivate it"
                )
            forget_reference(self.uow, {field_type}, option.id)
            self.uow.catalog.delete(option)

    def set_links(self, option_id: int, cmd: CatalogLinksUpdate) -> CatalogOption:
        """Make this value's links to one other category exactly ``option_ids``.
        Links are two-way: both ends see the result (it is one row)."""
        self.services.require(Permission.MANAGE_CATALOG)
        with self.uow.transaction():
            option = self.uow.catalog.require(option_id)
            if cmd.category == option.category:
                raise RuleViolation("A value can only be linked to values of another category")
            wanted = list(dict.fromkeys(cmd.option_ids))
            targets = self.uow.catalog.get_many(wanted)
            if len(targets) != len(wanted):
                raise RuleViolation("One or more values to link no longer exist")
            for t in targets:
                if t.category != cmd.category:
                    raise RuleViolation(f"'{t.value}' is a {t.category.value}, "
                                        f"not a {cmd.category.value}")
            current = {
                oid for oid in self.uow.catalog.linked_ids(option.id)
                if self.uow.catalog.require(oid).category == cmd.category
            }
            for oid in current - set(wanted):
                self.uow.catalog.unlink(option.id, oid)
            for oid in set(wanted) - current:
                self.uow.catalog.link(option.id, oid)
            return option
