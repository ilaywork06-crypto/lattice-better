"""Field groups: named, reusable sets of field definitions.

Fields are validated as a template's are, against the most permissive kind of
template (a commercial card): anything a group holds is usable by *some*
template; whether it fits a particular one is checked when that template is
saved.
"""

from __future__ import annotations

from lattice_core.db.models import FieldGroup, FieldGroupField
from lattice_core.domain.enums import CardType, ItemType
from lattice_core.domain.errors import Conflict, RuleViolation
from lattice_core.domain.permissions import Permission
from lattice_core.schemas.templates import FieldGroupCreate, FieldGroupUpdate, FieldIn
from lattice_core.services.base import Service
from lattice_core.services.field_specs import normalize_fields


class FieldGroupService(Service):
    def list(self, search: str | None = None) -> list[FieldGroup]:
        self.services.require(Permission.READ)
        return self.uow.field_groups.list(search)

    def get(self, group_id: int) -> FieldGroup:
        self.services.require(Permission.READ)
        return self.uow.field_groups.require(group_id)

    def _fields(self, raw: list[FieldIn]) -> list[FieldGroupField]:
        if not raw:
            raise RuleViolation("A field group needs at least one field")
        specs = normalize_fields(
            self.services.values,
            [f.model_copy(update={"id": None}) for f in raw],
            item_type=ItemType.CARD,
            card_type=CardType.COMMERCIAL,
        )
        return [
            FieldGroupField(key=s.key, label=s.label, field_type=s.field_type, mode=s.mode,
                            required=s.required, position=s.position, config=s.config,
                            fixed_value=s.fixed_value)
            for s in specs
        ]

    def _check_name(self, name: str, exclude_id: int | None) -> str:
        clean = name.strip()
        if not clean:
            raise RuleViolation("A field group needs a name")
        clash = self.uow.field_groups.name_clash(clean, exclude_id)
        if clash:
            raise Conflict(f"A field group named '{clash.name}' already exists")
        return clean

    def create(self, cmd: FieldGroupCreate) -> FieldGroup:
        self.services.require(Permission.WRITE_FIELD_GROUPS)
        with self.uow.transaction():
            group = FieldGroup(name=self._check_name(cmd.name, None),
                               description=(cmd.description or "").strip() or None,
                               created_by=self.actor.id)
            group.fields = self._fields(cmd.fields)
            self.uow.field_groups.add(group)
            self.uow.session.flush()
            self.audit.record(
                "field_group.create",
                f"Created the field group '{group.name}' ({len(group.fields)} fields)",
                details={"field_group_id": group.id},
            )
            return group

    def update(self, group_id: int, cmd: FieldGroupUpdate) -> FieldGroup:
        self.services.require(Permission.WRITE_FIELD_GROUPS)
        with self.uow.transaction():
            group = self.uow.field_groups.require(group_id)
            if cmd.name is not None:
                group.name = self._check_name(cmd.name, group.id)
            if "description" in cmd.model_fields_set:
                group.description = (cmd.description or "").strip() or None
            if cmd.fields is not None:
                fields = self._fields(cmd.fields)
                group.fields.clear()
                self.uow.session.flush()  # free the (group, key) pairs before re-adding
                group.fields.extend(fields)
            self.audit.record("field_group.update", f"Updated the field group '{group.name}'",
                              details={"field_group_id": group.id})
            return group

    def delete(self, group_id: int) -> None:
        self.services.require(Permission.WRITE_FIELD_GROUPS)
        with self.uow.transaction():
            group = self.uow.field_groups.require(group_id)
            self.audit.record("field_group.delete", f"Deleted the field group '{group.name}'",
                              details={"field_group_id": group.id})
            self.uow.field_groups.delete(group)
