"""Template fields: the pure rules.

* Formats (``XX-#####``), keys and emptiness.
* Coercion of *scalar* values (text, numbers, dates, …) into their canonical
  stored form. Values that reference other rows (users, catalog values,
  locations, items, files) need a lookup and are resolved in the application
  layer (``services/field_values.py``) on top of these.
* The structural rules of a field definition (which modes a type allows, which
  types a kind of template may use).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from lattice_core.domain.enums import (
    PER_UNIT_FIELD_TYPES,
    SYSTEM_FIELD_TYPES,
    CardTracking,
    CardType,
    FieldMode,
    FieldType,
    ItemState,
    ItemType,
    card_tracking,
)

DEFAULT_DESCRIPTION_MIN = 8
LETTERS = tuple(chr(c) for c in range(ord("A"), ord("Z") + 1))
_URL_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://\S+$")
_KEY_RE = re.compile(r"[^a-z0-9]+")
_TRUE = {"true", "yes", "1", "y", "v", "כן"}
_FALSE = {"false", "no", "0", "n", "x", "לא"}

#: Types a template of each kind may not use.
FORBIDDEN_BY_ITEM_TYPE: dict[ItemType, frozenset[FieldType]] = {
    ItemType.SETUP: frozenset({FieldType.PARENT, FieldType.QUANTITY}),  # always top, one unit
    ItemType.ASSEMBLY: frozenset({FieldType.QUANTITY}),
    ItemType.CARD: frozenset(),
}


class InvalidValue(ValueError):
    """A value doesn't fit its field; the message says why, for a human."""


@dataclass(slots=True)
class FieldSpec:
    """A validated field definition, ready to be stored on a template or group."""

    key: str
    label: str
    field_type: FieldType
    mode: FieldMode
    required: bool
    position: int
    config: dict = field(default_factory=dict)
    fixed_value: Any = None
    id: int | None = None
    copy_files_from: int | None = None


# ─────────────────────────── small helpers ───────────────────────────
def is_empty(value: Any) -> bool:
    return value is None or value == "" or value == []


def make_key(label: str, taken: set[str]) -> str:
    """A stable machine name for a field, unique among ``taken``."""
    base = _KEY_RE.sub("_", label.lower()).strip("_")[:48] or "field"
    if base[0].isdigit():
        base = f"f_{base}"
    key, n = base, 2
    while key in taken:
        key = f"{base}_{n}"
        n += 1
    return key


def apply_pattern(pattern: str, raw: str) -> str:
    """Fill a ``XX-#####`` format: ``#`` is a digit the user types, the rest is
    filled in. Accepts the digits alone or the complete value."""
    raw = raw.strip()
    full = "^" + "".join(r"\d" if ch == "#" else re.escape(ch) for ch in pattern) + "$"
    if re.match(full, raw):
        return raw
    digits = re.sub(r"\s", "", raw)
    slots = pattern.count("#")
    if not digits.isdigit() or len(digits) != slots:
        raise InvalidValue(
            f"expected {slots} digit(s) for the format '{pattern}' "
            "(the other characters are filled in automatically)"
        )
    it = iter(digits)
    return "".join(next(it) if ch == "#" else ch for ch in pattern)


def as_int(value: Any, what: str = "a whole number") -> int:
    if isinstance(value, bool):
        raise InvalidValue(f"expected {what}")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        raise InvalidValue(f"expected {what}") from None


def split_list(value: Any) -> list[Any]:
    """A list as given, or a comma/semicolon separated string (spreadsheets)."""
    if isinstance(value, (list, tuple, set)):
        return list(value)
    return [v.strip() for v in re.split(r"[,;]", str(value)) if v.strip()]


# ─────────────────────────── scalar coercion ───────────────────────────
def coerce_scalar(field_type: FieldType, value: Any, config: dict | None = None) -> Any:  # noqa: C901
    """Canonical stored value of a non-reference field (``None`` stays ``None``)."""
    config = config or {}
    if is_empty(value):
        return None

    match field_type:
        case FieldType.TEXT:
            return str(value).strip() or None

        case FieldType.DESCRIPTION:
            text = str(value).strip()
            minimum = int(config.get("min_length") or DEFAULT_DESCRIPTION_MIN)
            visible = len(re.sub(r"\s", "", text))
            if visible < minimum:
                raise InvalidValue(f"needs at least {minimum} non-blank characters (has {visible})")
            return text

        case FieldType.STRING | FieldType.SERIAL_STRING:
            is_whole = isinstance(value, float) and value.is_integer()  # a spreadsheet's 12345.0
            text = (str(int(value)) if is_whole else str(value)).strip()
            pattern = config.get("pattern")
            return apply_pattern(pattern, text) if pattern else (text or None)

        case FieldType.LINK:
            text = str(value).strip()
            if not _URL_RE.match(text):
                raise InvalidValue("expected a link such as https://example.com/…")
            return text

        case FieldType.ENUM:
            text = str(value).strip()
            options = [str(o) for o in config.get("options") or []]
            if text not in options:
                raise InvalidValue(f"'{text}' is not one of: {', '.join(options)}")
            return text

        case FieldType.LETTER:
            text = str(value).strip().upper()
            if text not in LETTERS:
                raise InvalidValue("expected a single letter A–Z")
            return text

        case FieldType.DATE:
            if isinstance(value, datetime):
                return value.date().isoformat()
            if isinstance(value, date):
                return value.isoformat()
            text = str(value).strip()[:10]
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y"):
                try:
                    return datetime.strptime(text, fmt).date().isoformat()
                except ValueError:
                    continue
            raise InvalidValue("expected a date (YYYY-MM-DD)")

        case FieldType.INTEGER:
            return as_int(value)

        case FieldType.QUANTITY:
            qty = as_int(value)
            if qty < 1:
                raise InvalidValue("a quantity must be at least 1")
            return qty

        case FieldType.DECIMAL:
            if isinstance(value, bool):
                raise InvalidValue("expected a number")
            try:
                return float(Decimal(str(value).strip()))
            except (InvalidOperation, ValueError):
                raise InvalidValue("expected a number") from None

        case FieldType.BOOLEAN:
            if isinstance(value, bool):
                return value
            text = str(value).strip().lower()
            if text in _TRUE:
                return True
            if text in _FALSE:
                return False
            raise InvalidValue("expected yes / no")

        case FieldType.STATUS:
            try:
                return ItemState(str(value).strip().lower()).value
            except ValueError:
                allowed = ", ".join(s.value for s in ItemState)
                raise InvalidValue(f"expected one of: {allowed}") from None

    raise InvalidValue(f"{field_type.value} is not a scalar field type")  # pragma: no cover


# ─────────────────────────── definition rules ───────────────────────────
def structural_problem(
    field_type: FieldType,
    mode: FieldMode,
    *,
    item_type: ItemType,
    card_type: CardType | None,
) -> str | None:
    """Why this (type, mode) can't be used on this kind of template, if it can't."""
    if field_type in FORBIDDEN_BY_ITEM_TYPE[item_type]:
        return f"a {item_type.value} template cannot have a {field_type.value} field"
    if field_type == FieldType.QUANTITY and card_tracking(card_type) is not CardTracking.QUANTITY:
        return ("only commercial cards are counted by quantity — every other card is one "
                "unit per serial")
    if field_type in PER_UNIT_FIELD_TYPES and mode == FieldMode.FIXED:
        return (f"{field_type.value} describes each unit, so it can be filled per item or "
                "chosen from a list, not fixed for all items")
    if field_type == FieldType.FILES and mode == FieldMode.CHOICE:
        return "a files field cannot be a list"
    if field_type == FieldType.PARENT and mode == FieldMode.CHOICE:
        return "the parent is chosen per item"
    return None


def is_system(field_type: FieldType) -> bool:
    return field_type in SYSTEM_FIELD_TYPES


def default_value(spec_mode: FieldMode, field_type: FieldType, config: dict, fixed_value: Any):
    """The value a new item gets when its creator leaves the field alone."""
    if spec_mode == FieldMode.FIXED:
        return fixed_value
    if spec_mode == FieldMode.CHOICE:
        options = (config or {}).get("options") or []
        if not options:
            return None
        return [options[0]] if field_type == FieldType.MANAGERS else options[0]
    return None


def check_in_options(mode: FieldMode, field_type: FieldType, config: dict, value: Any) -> None:
    """A list field's value must come from the template's list."""
    if mode != FieldMode.CHOICE and field_type != FieldType.ENUM:
        return
    options = (config or {}).get("options") or []
    for v in value if isinstance(value, list) else [value]:
        if v not in options:
            raise InvalidValue("is not one of the values this template allows")
