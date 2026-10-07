"""What may sit inside what.

The coarse rule is by item type (a card goes into an assembly or a setup, an
assembly into a setup). The fine rule is by template: a container's template
lists which templates may sit inside it, with a minimum and maximum count.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from lattice_core.domain.enums import ItemState, ItemType

ALLOWED_CHILD_TYPES: dict[ItemType, frozenset[ItemType]] = {
    ItemType.SETUP: frozenset({ItemType.ASSEMBLY, ItemType.CARD}),
    ItemType.ASSEMBLY: frozenset({ItemType.CARD}),
    ItemType.CARD: frozenset(),
}


def can_contain(container: ItemType, child: ItemType) -> bool:
    return child in ALLOWED_CHILD_TYPES[container]


@dataclass(frozen=True, slots=True)
class Unit:
    """The slice of an item that capacity rules look at."""

    template_id: int
    quantity: int
    state: ItemState


def units_of(contents: Iterable[Unit], template_id: int) -> int:
    """Units of one template among ``contents`` — destroyed ones take no place."""
    return sum(
        (u.quantity or 1)
        for u in contents
        if u.template_id == template_id and u.state != ItemState.DESTROYED
    )


@dataclass(frozen=True, slots=True)
class Slot:
    """One line of a container template's contents."""

    template_id: int
    template_name: str
    min_count: int
    max_count: int | None


@dataclass(frozen=True, slots=True)
class SlotFill:
    slot: Slot
    count: int

    @property
    def missing(self) -> int:
        return max(self.slot.min_count - self.count, 0)

    @property
    def is_full(self) -> bool:
        return self.slot.max_count is not None and self.count >= self.slot.max_count

    @property
    def over(self) -> int:
        if self.slot.max_count is None:
            return 0
        return max(self.count - self.slot.max_count, 0)


def fill(slots: Iterable[Slot], contents: list[Unit]) -> list[SlotFill]:
    return [SlotFill(s, units_of(contents, s.template_id)) for s in slots]
