"""What sits inside what, and where things are.

**Being linked means being physically inside.** So a location cascades
strictly downward: moving a container drags everything inside it; linking an
item gives it (and its contents) its container's location; and a linked item
has no location of its own — it can't be moved alone.

A container's template decides which templates may sit inside it and how many
units of each (``min_count`` .. ``max_count``); a link that would exceed a
maximum is refused, and an item with fewer than a minimum is *incomplete*.
"""

from __future__ import annotations

from lattice_core.db.models import Item
from lattice_core.domain.enums import ItemState, ItemType
from lattice_core.domain.errors import RuleViolation
from lattice_core.domain.hierarchy import Slot, SlotFill, Unit, can_contain, fill
from lattice_core.domain.permissions import Permission
from lattice_core.schemas.items import ContentsCommand, LinkCommand, MoveCommand, UnlinkCommand
from lattice_core.services.base import Service


def _units(items: list[Item]) -> list[Unit]:
    return [Unit(i.template_id, i.quantity, i.state) for i in items]


def slots_of(container: Item) -> list[Slot]:
    return [
        Slot(link.child_template_id, link.child.name, link.min_count, link.max_count)
        for link in container.template.child_links
    ]


def composition(container: Item) -> list[SlotFill]:
    return fill(slots_of(container), _units(container.children))


def missing_children(container: Item) -> int:
    if container.type == ItemType.CARD:
        return 0
    return sum(f.missing for f in composition(container))


def check_capacity(container: Item, contents: list[Item]) -> None:
    for f in fill(slots_of(container), _units(contents)):
        if f.over:
            raise RuleViolation(
                f"'{container.label}' can hold at most {f.slot.max_count} × "
                f"'{f.slot.template_name}' — this would make it {f.count}"
            )


def check_fits(child: Item, container: Item) -> None:
    """Type, template and cycle rules (capacity is checked separately)."""
    if child.id is not None and child.id == container.id:
        raise RuleViolation("An item cannot be placed inside itself")
    if not can_contain(container.type, child.type):
        raise RuleViolation(f"A {child.type.value} cannot go inside a {container.type.value}")
    if container.template.child_link(child.template_id) is None:
        raise RuleViolation(
            f"'{container.template.name}' templates don't include '{child.template.name}' — "
            "add it to that template's contents to allow it"
        )
    if child.id is not None and container in child.descendants():
        raise RuleViolation("That would create a cycle in the hierarchy")


class HierarchyService(Service):
    # ── move ──
    def move(self, item_id: int, cmd: MoveCommand) -> Item:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            item = self.uow.items.require(item_id)
            location = self.uow.locations.require(cmd.location_id)
            if item.parent is not None:
                where = f"{item.parent.type.value} '{item.parent.label}'"
                raise RuleViolation(
                    f"'{item.label}' sits inside {where}, so it has no location of its own. "
                    f"Move {where} instead — everything inside it follows — or unlink "
                    f"'{item.label}' first if it has physically come out."
                )
            before = item.location_id
            item.location_id = location.id
            item.location = location
            dragged = item.descendants()
            for d in dragged:
                d.location_id = location.id
                d.location = location
            self.services.inventory.stock_changed([item, *dragged])
            self.audit.record(
                "move",
                f"Moved {item.type.value} '{item.label}' to '{location.name}'"
                + (f" (+{len(dragged)} items inside)" if dragged else ""),
                item=item,
                details={
                    "from_location_id": before,
                    "to_location_id": location.id,
                    "cascaded_item_ids": [d.id for d in dragged],
                    "note": cmd.note,
                },
            )
            return item

    # ── link ──
    def link(self, item_id: int, cmd: LinkCommand) -> Item:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            child = self.uow.items.require(item_id)
            container = self.uow.items.require(cmd.parent_id)
            return self.place(child, container)

    def place(self, child: Item, container: Item, *, check_limits: bool = True) -> Item:
        """Put ``child`` inside ``container`` (the rules, the cascade, the audit)."""
        check_fits(child, container)
        if check_limits:
            others = [c for c in container.children if c is not child]
            check_capacity(container, [*others, child])
        previous = child.parent
        if previous is not None and previous is not container and child in previous.children:
            previous.children.remove(child)
        child.parent = container
        child.parent_id = container.id
        # The child — and everything already inside it — is wherever its
        # container is. A container with no location leaves them with none.
        moved = [child, *child.descendants()]
        for m in moved:
            m.location_id = container.location_id
            m.location = container.location
        self.services.inventory.stock_changed(moved)
        self.audit.record(
            "link",
            f"Placed {child.type.value} '{child.label}' inside '{container.label}'",
            item=child,
            details={"parent_id": container.id, "parent": container.label,
                     "previous_parent_id": previous.id if previous else None},
        )
        return child

    # ── unlink ──
    def unlink(self, item_id: int, cmd: UnlinkCommand) -> Item:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            return self.take_out(self.uow.items.require(item_id), cmd.location_id)

    def take_out(self, child: Item, location_id: int | None = None) -> Item:
        """Take an item out of its container. It stays where the container is
        unless ``location_id`` says where it now is."""
        container = child.parent
        if container is None:
            raise RuleViolation(f"'{child.label}' is not inside anything")
        container.children.remove(child)
        child.parent = None
        child.parent_id = None
        moved = [child, *child.descendants()]
        if location_id is not None:
            location = self.uow.locations.require(location_id)
            for m in moved:
                m.location_id = location.id
                m.location = location
        self.services.inventory.stock_changed(moved)
        self.audit.record(
            "unlink",
            f"Took {child.type.value} '{child.label}' out of '{container.label}'",
            item=child,
            details={"previous_parent_id": container.id, "location_id": child.location_id},
        )
        return child

    # ── contents ──
    def set_contents(self, item_id: int, cmd: ContentsCommand) -> Item:
        self.services.require(Permission.WRITE_ITEMS)
        with self.uow.transaction():
            container = self.uow.items.require(item_id)
            self.replace_contents(container, cmd.child_ids)
            return container

    def replace_contents(self, container: Item, child_ids: list[int]) -> None:
        """Make the container's contents exactly ``child_ids``.

        Everything is validated before anything is written, and additions and
        removals go through ``place`` / ``take_out``, so cascades and the audit
        trail behave exactly as they do anywhere else.
        """
        desired = list(dict.fromkeys(child_ids))
        current = {c.id for c in container.children}
        to_add: list[Item] = []
        for cid in desired:
            if cid in current:
                continue
            child = self.uow.items.require(cid)
            check_fits(child, container)
            to_add.append(child)
        keep = [c for c in container.children if c.id in set(desired)]
        to_remove = [c for c in container.children if c.id not in set(desired)]
        check_capacity(container, keep + to_add)

        for child in to_remove:
            self.take_out(child)
        for child in to_add:
            self.place(child, container, check_limits=False)
        if to_add or to_remove:
            self.audit.record(
                "contents",
                f"Updated the contents of {container.type.value} '{container.label}' "
                f"(+{len(to_add)} / -{len(to_remove)})",
                item=container,
                details={"added": [c.id for c in to_add], "removed": [c.id for c in to_remove]},
            )

    # ── state ──
    def recheck_after_state_change(self, item: Item, before: ItemState) -> None:
        """A destroyed unit takes no place in its container; back in service it does."""
        if before == ItemState.DESTROYED and item.parent is not None:
            check_capacity(item.parent, list(item.parent.children))
