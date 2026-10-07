"""Serial numbers: ``C-XXX-###`` (card), ``A-XXX-###`` (assembly), ``S-XXX-###`` (setup).

* The letter is the item type; ``XXX`` is the template's three-letter prefix;
  ``###`` is issued as one above the highest number used under that type and
  prefix (it simply grows past 999).
* A serial may be typed by hand: it must keep the scheme — the type's letter and
  the template's prefix (or the prefix the item was originally issued under).
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

from lattice_core.domain.enums import SERIAL_LETTER, ItemType
from lattice_core.domain.errors import RuleViolation

PREFIX_RE = re.compile(r"^[A-Z]{3}$")
SERIAL_RE = re.compile(r"^([CAS])-([A-Z]{3})-(\d{3,})$")
_TYPE_BY_LETTER = {letter: t for t, letter in SERIAL_LETTER.items()}


@dataclass(frozen=True, slots=True)
class Serial:
    item_type: ItemType
    prefix: str
    number: int

    def __str__(self) -> str:
        return format_serial(self.item_type, self.prefix, self.number)


def normalize_prefix(prefix: str | None) -> str:
    value = (prefix or "").strip().upper()
    if not PREFIX_RE.match(value):
        raise RuleViolation(
            "The serial prefix must be exactly three Latin letters (A–Z), e.g. 'PRB'."
        )
    return value


def format_serial(item_type: ItemType, prefix: str, number: int) -> str:
    return f"{SERIAL_LETTER[item_type]}-{prefix}-{number:03d}"


def parse_serial(raw: str | None) -> Serial | None:
    m = SERIAL_RE.match((raw or "").strip().upper())
    if not m:
        return None
    return Serial(_TYPE_BY_LETTER[m.group(1)], m.group(2), int(m.group(3)))


def series_head(item_type: ItemType, prefix: str) -> str:
    """What every serial of a template starts with, e.g. ``"C-PRB-"``."""
    return f"{SERIAL_LETTER[item_type]}-{prefix}-"


def next_number(existing_serials: Iterable[str]) -> int:
    highest = 0
    for s in existing_serials:
        parsed = parse_serial(s)
        if parsed is not None:
            highest = max(highest, parsed.number)
    return highest + 1


def check_manual_serial(
    raw: str,
    *,
    item_type: ItemType,
    template_name: str,
    template_prefix: str,
    current_serial: str | None = None,
) -> str:
    """Validate a hand-typed serial's *shape*. Uniqueness is the caller's job."""
    example = format_serial(item_type, template_prefix, 1)
    parsed = parse_serial(raw)
    if parsed is None:
        raise RuleViolation(f"'{raw}' is not a valid serial — expected the form {example}")
    if parsed.item_type != item_type:
        raise RuleViolation(
            f"A {item_type.value} serial starts with '{SERIAL_LETTER[item_type]}-' (e.g. {example})"
        )
    allowed = {template_prefix}
    current = parse_serial(current_serial)
    if current is not None:
        # An item keeps the prefix it was issued under, even after the
        # template's prefix changes: the serial is the label on the board.
        allowed.add(current.prefix)
    if parsed.prefix not in allowed:
        raise RuleViolation(
            f"Serials of '{template_name}' use the prefix '{template_prefix}' (e.g. {example})"
        )
    return str(parsed)
