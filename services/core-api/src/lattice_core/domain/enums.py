"""The vocabulary of the domain, and the fixed facts that hang off it."""

from __future__ import annotations

from enum import StrEnum


class ItemType(StrEnum):
    SETUP = "setup"        # top of the tree
    ASSEMBLY = "assembly"  # sits in a setup, holds cards
    CARD = "card"          # leaf


class CardType(StrEnum):
    COPIED = "copied"
    HOUSE = "house"
    WHITE = "white"
    FACTORY = "factory"
    COMMERCIAL = "commercial"


class CardTracking(StrEnum):
    """How a card's stock is counted: one record per board, or a quantity."""

    SERIAL = "serial"
    QUANTITY = "quantity"


class ItemState(StrEnum):
    BUILT = "built"          # the default for every new item
    OK = "ok"
    FAULTY = "faulty"
    DESTROYED = "destroyed"


class StorageStatus(StrEnum):
    """Where a card physically is. Always *derived*, never stored."""

    DESICCATOR = "desiccator"  # at a desiccator location (loose or assembled)
    ASSEMBLED = "assembled"    # inside another item, outside the desiccator
    IN_USE = "in_use"          # loose, outside the desiccator


class UserRole(StrEnum):
    VIEWER = "viewer"
    EDITOR = "editor"
    MANAGER = "manager"


class ChangeStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ChangeAction(StrEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    MOVE = "move"
    LINK = "link"
    UNLINK = "unlink"
    STATE_CHANGE = "state_change"
    TEMPLATE_CREATE = "template_create"
    TEMPLATE_UPDATE = "template_update"


class CatalogCategory(StrEnum):
    PROJECT = "project"
    INDUSTRY = "industry"
    TEAM = "team"


class FieldMode(StrEnum):
    """Who decides a field's value.

    * ``fixed``  — set once on the template and shared by every item.
    * ``choice`` — the template defines a list; each item picks one (the first
      is the default).
    * ``item``   — filled in per item when it is created.
    """

    FIXED = "fixed"
    CHOICE = "choice"
    ITEM = "item"


class FieldType(StrEnum):
    # Free-form values, stored per item in ``item_field_values``.
    TEXT = "text"
    DESCRIPTION = "description"
    STRING = "string"
    SERIAL_STRING = "serial_string"
    LINK = "link"
    ENUM = "enum"
    LETTER = "letter"
    DATE = "date"
    INTEGER = "integer"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    FILES = "files"
    # System values, stored in real columns of ``items``.
    INDUSTRY = "industry"
    PROJECT = "project"
    TEAM = "team"
    MANAGERS = "managers"
    RESPONSIBLE = "responsible"
    LOCATION = "location"
    PARENT = "parent"
    STATUS = "status"
    QUANTITY = "quantity"


# ─────────────────────────── fixed facts ───────────────────────────

#: The letter every serial of an item type starts with (S-XXX-###, …).
SERIAL_LETTER: dict[ItemType, str] = {
    ItemType.CARD: "C",
    ItemType.ASSEMBLY: "A",
    ItemType.SETUP: "S",
}

#: Only a commercial card is a quantity of interchangeable parts.
CARD_TRACKING: dict[CardType, CardTracking] = {
    CardType.COPIED: CardTracking.SERIAL,
    CardType.HOUSE: CardTracking.SERIAL,
    CardType.WHITE: CardTracking.SERIAL,
    CardType.FACTORY: CardTracking.SERIAL,
    CardType.COMMERCIAL: CardTracking.QUANTITY,
}

#: States that count as usable stock (what a stock threshold watches).
AVAILABLE_STATES: frozenset[ItemState] = frozenset({ItemState.BUILT, ItemState.OK})

#: Field types stored as real columns — at most one of each per template.
SYSTEM_FIELD_TYPES: frozenset[FieldType] = frozenset({
    FieldType.INDUSTRY, FieldType.PROJECT, FieldType.TEAM, FieldType.MANAGERS,
    FieldType.RESPONSIBLE, FieldType.LOCATION, FieldType.PARENT, FieldType.STATUS,
    FieldType.QUANTITY,
})

#: Physical, per-unit facts: chosen per item or from a list, never fixed.
PER_UNIT_FIELD_TYPES: frozenset[FieldType] = frozenset({
    FieldType.LOCATION, FieldType.PARENT, FieldType.STATUS, FieldType.QUANTITY,
})

#: Physical facts that have their own actions (move / link / state change), so
#: an edit form never writes them.
ACTION_ONLY_FIELD_TYPES: dict[FieldType, str] = {
    FieldType.LOCATION: "move",
    FieldType.PARENT: "link / unlink",
    FieldType.STATUS: "change state",
}

#: System values that a fixed template field pushes into every item's columns.
PROPAGATED_FIELD_TYPES: frozenset[FieldType] = frozenset({
    FieldType.INDUSTRY, FieldType.PROJECT, FieldType.TEAM, FieldType.RESPONSIBLE,
    FieldType.MANAGERS,
})

CATALOG_FIELD_TYPES: dict[FieldType, CatalogCategory] = {
    FieldType.INDUSTRY: CatalogCategory.INDUSTRY,
    FieldType.PROJECT: CatalogCategory.PROJECT,
    FieldType.TEAM: CatalogCategory.TEAM,
}

#: Field types whose value is a list of ids.
MULTI_VALUE_FIELD_TYPES: frozenset[FieldType] = frozenset({FieldType.MANAGERS, FieldType.FILES})


def card_tracking(card_type: CardType | None) -> CardTracking | None:
    return CARD_TRACKING.get(card_type) if card_type is not None else None
