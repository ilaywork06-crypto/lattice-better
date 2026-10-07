"""Items: create (from a template), edit, change state, delete.

These use cases are the single source of truth for item mutations: managers
call them directly and approved change requests call them too, so the rules
live in exactly one place.
"""

from __future__ import annotations

from lattice_core.db.models import ExtraItem, Item, StateHistory
from lattice_core.domain.enums import (
    SYSTEM_FIELD_TYPES,
    CardTracking,
    FieldMode,
    FieldType,
    ItemState,
    ItemType,
)
from lattice_core.domain.errors import NotFound, RuleViolation
from lattice_core.domain.fields import is_empty
from lattice_core.domain.permissions import Permission
from lattice_core.domain.serials import check_manual_serial
from lattice_core.repositories.items import ItemFilter
from lattice_core.schemas.items import (
    BulkAction,
    BulkCommand,
    ExtraIn,
    ItemCreate,
    ItemUpdate,
    LinkCommand,
    MoveCommand,
    StateCommand,
    UnlinkCommand,
)
from lattice_core.services.base import Service
from lattice_core.services.hierarchy import check_capacity
from lattice_core.services.item_values import (
    effective_value,
    resolve_supplied,
    write_own_value,
    write_system_value,
)


class ItemService(Service):
    # ─────────────────────────── queries ───────────────────────────
    def page(self, f: ItemFilter, *, limit: int, offset: int) -> tuple[list[Item], int]:
        self.services.require(Permission.READ)
        return self.uow.items.page(f, limit=limit, offset=offset)

    def get(self, item_id: int) -> Item:
        self.services.require(Permission.READ)
        return self.uow.items.require(item_id)

    # ─────────────────────────── create ───────────────────────────
    def create(self, cmd: ItemCreate) -> Item:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            template = self.uow.templates.get(cmd.template_id)
            if template is None:
                raise RuleViolation(
                    "Items are created from a template — choose an existing template"
                )
            values = resolve_supplied(self.services.values, template, cmd.values, creating=True)

            item = Item(template=template, type=template.type, state=ItemState.BUILT,
                        quantity=1, created_by=self.actor.id)
            parent_id = None
            for f in template.fields:
                value = f.fixed_value if f.mode == FieldMode.FIXED else values.get(f.id)
                if f.field_type == FieldType.PARENT:
                    parent_id = value
                elif f.field_type in SYSTEM_FIELD_TYPES:
                    write_system_value(self.uow, item, f.field_type, value)
            _enforce_quantity(item)
            item.serial = self._serial_for(template, cmd.serial)

            parent = self.uow.items.require(parent_id) if parent_id else None
            if item.location_id is None and parent is None and item.type == ItemType.CARD:
                # A new card goes to the desiccator unless told otherwise.
                desiccator = self.uow.locations.first_desiccator()
                item.location_id = desiccator.id if desiccator else None

            self.uow.items.add(item)
            self.uow.session.flush()
            for f in template.fields:
                if f.mode == FieldMode.FIXED or f.field_type in SYSTEM_FIELD_TYPES:
                    continue
                if f.field_type == FieldType.FILES:
                    self.services.documents.sync_item_field(item, f, values.get(f.id) or [])
                else:
                    write_own_value(item, f, values.get(f.id))

            item.state_history.append(StateHistory(state=item.state, note="Item created",
                                                   changed_by=self.actor.id))
            self.audit.record(
                "create",
                f"Created {item.type.value} '{item.label}'",
                item=item,
                details={"template_id": template.id, "serial": item.serial},
            )
            self.services.inventory.stock_changed([item])

            if parent is not None:
                self.services.hierarchy.place(item, parent)
            for cid in dict.fromkeys(cmd.child_ids):
                self.services.hierarchy.place(self.uow.items.require(cid), item)
            return item

    def _serial_for(self, template, typed: str | None, item: Item | None = None) -> str:
        if typed and typed.strip():
            serial = check_manual_serial(
                typed,
                item_type=template.type,
                template_name=template.name,
                template_prefix=template.serial_prefix,
                current_serial=item.serial if item else None,
            )
            clash = self.uow.items.by_serial(serial)
            if clash is not None and clash is not item:
                raise RuleViolation(
                    f"Serial '{serial}' is already used by {clash.type.value} '{clash.name}'"
                )
            return serial
        return self.services.templates.next_serial(template)

    # ─────────────────────────── update ───────────────────────────
    def update(self, item_id: int, cmd: ItemUpdate) -> Item:
        """Edit an item's own values and/or its serial. Fixed fields are edited
        on the template; location, parent and state have their own actions."""
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            item = self.uow.items.require(item_id)
            template = item.template
            values = resolve_supplied(self.services.values, template, cmd.values, creating=False)
            by_id = {f.id: f for f in template.fields}
            changed: dict[str, list] = {}

            for field_id, value in values.items():
                f = by_id[field_id]
                before = effective_value(self.uow, item, f)
                if f.field_type in (FieldType.MANAGERS, FieldType.FILES):
                    value = sorted(value or [])
                    before = sorted(before or [])
                if before == value or (is_empty(before) and is_empty(value)):
                    continue
                if f.field_type == FieldType.FILES:
                    self.services.documents.sync_item_field(item, f, value)
                elif f.field_type in SYSTEM_FIELD_TYPES:
                    write_system_value(self.uow, item, f.field_type, value)
                else:
                    write_own_value(item, f, value)
                changed[f.label] = [before, value]

            _enforce_quantity(item)
            if any(by_id[i].field_type == FieldType.QUANTITY for i in values):
                self.services.inventory.stock_changed([item])
                if item.parent is not None and item.state != ItemState.DESTROYED:
                    check_capacity(item.parent, list(item.parent.children))

            if cmd.serial is not None and cmd.serial.strip().upper() != item.serial:
                new = self._serial_for(template, cmd.serial, item)
                changed["serial"] = [item.serial, new]
                item.serial = new

            if changed:
                self.audit.record(
                    "update",
                    f"Updated {item.type.value} '{item.label}' ({', '.join(changed)})",
                    item=item,
                    details={"changed": changed},
                )
            return item

    # ─────────────────────────── state ───────────────────────────
    def change_state(self, item_id: int, cmd: StateCommand) -> Item:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            item = self.uow.items.require(item_id)
            before = item.state
            if before == cmd.state:
                return item
            if ItemState.FAULTY in (before, cmd.state) and not (cmd.note and cmd.note.strip()):
                raise RuleViolation(
                    "A note explaining how the fault occurred or was resolved is required for "
                    "changes into or out of 'faulty'"
                )
            item.state = cmd.state
            self.services.hierarchy.recheck_after_state_change(item, before)
            item.state_history.append(StateHistory(state=cmd.state, note=cmd.note,
                                                   changed_by=self.actor.id))
            self.services.inventory.stock_changed([item])
            self.audit.record(
                "state_change",
                f"State of '{item.label}': {before.value} → {cmd.state.value}",
                item=item,
                details={"from": before.value, "to": cmd.state.value, "note": cmd.note},
            )
            return item

    # ─────────────────────────── delete ───────────────────────────
    def delete(self, item_id: int) -> None:
        """Delete an item. Its contents are taken out (kept where they are), not deleted."""
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            item = self.uow.items.require(item_id)
            self.audit.record(
                "delete",
                f"Deleted {item.type.value} '{item.label}'",
                item=item,
                details={"type": item.type.value, "serial": item.serial},
            )
            self.services.inventory.stock_changed([item, *item.descendants()])
            for doc in list(item.documents):
                self.services.documents.delete(doc)
            for child in list(item.children):
                child.parent = None
                child.parent_id = None
            if item.parent is not None:
                item.parent.children.remove(item)
            self.uow.session.flush()
            self.uow.items.delete(item)

    # ─────────────────────────── bulk ───────────────────────────
    def bulk(self, cmd: BulkCommand) -> int:
        """Apply one action to many items — all of them, or (on any error) none."""
        self.services.require(Permission.WRITE_ITEMS)
        ids = list(dict.fromkeys(cmd.item_ids))
        hierarchy = self.services.hierarchy
        with self.uow.transaction():
            missing = [i for i in ids if self.uow.items.get(i) is None]
            if missing:
                raise NotFound("Items " + ", ".join(f"#{i}" for i in missing))
            for iid in ids:
                match cmd.action:
                    case BulkAction.MOVE:
                        if cmd.location_id is None:
                            raise RuleViolation("Choose the location to move the items to")
                        hierarchy.move(iid, MoveCommand(location_id=cmd.location_id,
                                                        note=cmd.note))
                    case BulkAction.STATE_CHANGE:
                        if cmd.state is None:
                            raise RuleViolation("Choose the state to change the items to")
                        self.change_state(iid, StateCommand(state=cmd.state, note=cmd.note))
                    case BulkAction.LINK:
                        if cmd.parent_id is None:
                            raise RuleViolation("Choose the item to place them inside")
                        hierarchy.link(iid, LinkCommand(parent_id=cmd.parent_id))
                    case BulkAction.UNLINK:
                        hierarchy.unlink(iid, UnlinkCommand(location_id=cmd.location_id))
                    case BulkAction.DELETE:
                        self.delete(iid)
        return len(ids)

    # ─────────────────────────── extras (setups) ───────────────────────────
    def add_extra(self, item_id: int, cmd: ExtraIn) -> ExtraItem:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            item = self.uow.items.require(item_id)
            if item.type != ItemType.SETUP:
                raise RuleViolation("Extra items belong to setups only")
            extra = ExtraItem(**cmd.model_dump())
            item.extras.append(extra)
            self.audit.record("update", f"Added '{extra.name}' to '{item.label}'", item=item,
                              details={"extra": cmd.model_dump()})
            self.uow.session.flush()
            return extra

    def remove_extra(self, item_id: int, extra_id: int) -> None:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            item = self.uow.items.require(item_id)
            extra = next((e for e in item.extras if e.id == extra_id), None)
            if extra is None:
                raise NotFound("Extra item", extra_id)
            item.extras.remove(extra)
            self.audit.record("update", f"Removed '{extra.name}' from '{item.label}'", item=item)


def _enforce_quantity(item: Item) -> None:
    counted = (item.type == ItemType.CARD
               and item.template.tracking is CardTracking.QUANTITY)
    if not counted:
        if (item.quantity or 1) != 1:
            raise RuleViolation(
                "Only commercial cards hold a quantity; every other item is one unit"
            )
        item.quantity = 1
