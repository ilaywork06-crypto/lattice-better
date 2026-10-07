"""Turning whatever a form, a proposal or a spreadsheet cell supplied into the
canonical stored value of a field — or a precise reason why not — and turning
stored values back into something people can read.

Scalar types are handled by the pure rules in ``domain.fields``; this class
adds the types that refer to other rows (catalog values, users, locations,
items, files), which need a lookup. A spreadsheet may name a reference by its
text (a user's email, a location's name, an item's serial); the API usually
sends ids. Both are accepted, and ids are what get stored.
"""

from __future__ import annotations

from typing import Any

from lattice_core.db.models import Document
from lattice_core.domain.enums import (
    CATALOG_FIELD_TYPES,
    FieldMode,
    FieldType,
    UserRole,
)
from lattice_core.domain.fields import InvalidValue, as_int, coerce_scalar, is_empty, split_list
from lattice_core.services.uow import UnitOfWork


class FieldValues:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    # ─────────────────────────── input → stored ───────────────────────────
    def coerce(self, field_type: FieldType, value: Any, config: dict | None = None) -> Any:  # noqa: C901
        if is_empty(value):
            return None

        if field_type in CATALOG_FIELD_TYPES:
            category = CATALOG_FIELD_TYPES[field_type]
            option = self._catalog(category, value)
            if option is None:
                raise InvalidValue(f"'{value}' is not a known {category.value} in the catalog")
            if not option.active:
                raise InvalidValue(f"the {category.value} '{option.value}' is inactive")
            return option.id

        if field_type == FieldType.MANAGERS:
            ids = self._user_ids(value)
            users = {u.id: u for u in self.uow.users.get_many(ids)}
            for uid in ids:
                user = users.get(uid)
                if user is None or not user.is_active:
                    raise InvalidValue(f"user #{uid} is not an active user")
                if user.role != UserRole.MANAGER:
                    raise InvalidValue(f"{user.full_name} is not a manager")
            return ids or None

        if field_type == FieldType.RESPONSIBLE:
            ids = self._user_ids(value)
            if len(ids) != 1:
                raise InvalidValue("expected exactly one user")
            user = self.uow.users.get(ids[0])
            if user is None or not user.is_active:
                raise InvalidValue(f"user #{ids[0]} is not an active user")
            return user.id

        if field_type == FieldType.LOCATION:
            if isinstance(value, int) and not isinstance(value, bool):
                loc = self.uow.locations.get(value)
            else:
                text = str(value).strip()
                loc = self.uow.locations.by_name(text)
                if loc is None and text.isdigit():
                    loc = self.uow.locations.get(int(text))
            if loc is None:
                raise InvalidValue(f"'{value}' is not a known location")
            return loc.id

        if field_type == FieldType.PARENT:
            # Whether it *fits* is checked when linking (services/hierarchy.py).
            if isinstance(value, int) and not isinstance(value, bool):
                return value
            text = str(value).strip()
            item = self.uow.items.by_serial(text)
            if item is not None:
                return item.id
            if text.isdigit():
                return int(text)
            raise InvalidValue(f"'{text}' is not a known item serial")

        if field_type == FieldType.FILES:
            ids = list(dict.fromkeys(as_int(v, "a list of file ids") for v in split_list(value)))
            if len(self.uow.documents.get_many(ids)) != len(ids):
                raise InvalidValue("one or more uploaded files no longer exist")
            return ids

        return coerce_scalar(field_type, value, config)

    def _catalog(self, category, value):
        if isinstance(value, int) and not isinstance(value, bool):
            option = self.uow.catalog.get(value)
            return option if option is not None and option.category == category else None
        text = str(value).strip()
        option = self.uow.catalog.find(category, text)
        if option is None and text.isdigit():
            option = self.uow.catalog.get(int(text))
            if option is not None and option.category != category:
                option = None
        return option

    def _user_ids(self, value: Any) -> list[int]:
        """Ids — or (from a spreadsheet) emails or full names."""
        out: list[int] = []
        for v in split_list(value):
            if isinstance(v, int) and not isinstance(v, bool):
                uid = v
            else:
                text = str(v).strip()
                if text.isdigit():
                    uid = int(text)
                else:
                    user = self.uow.users.by_name_or_email(text)
                    if user is None:
                        raise InvalidValue(f"'{text}' is not a known user")
                    uid = user.id
            if uid not in out:
                out.append(uid)
        return out

    # ─────────────────────────── stored → readable ───────────────────────────
    def display(self, field_type: FieldType, value: Any) -> Any:
        """A readable form of a stored value: names instead of ids, documents
        as small objects. Scalars are returned unchanged."""
        if is_empty(value):
            return None
        if field_type in CATALOG_FIELD_TYPES:
            option = self.uow.catalog.get(value)
            return option.value if option else f"#{value}"
        if field_type == FieldType.MANAGERS:
            users = {u.id: u for u in self.uow.users.get_many(value)}
            return [users[i].full_name if i in users else f"#{i}" for i in value]
        if field_type == FieldType.RESPONSIBLE:
            user = self.uow.users.get(value)
            return user.full_name if user else f"#{value}"
        if field_type == FieldType.LOCATION:
            loc = self.uow.locations.get(value)
            return loc.name if loc else f"#{value}"
        if field_type == FieldType.PARENT:
            item = self.uow.items.get(value)
            return item.label if item else f"#{value}"
        if field_type == FieldType.FILES:
            return [_doc_brief(d) for d in self.uow.documents.get_many(value)]
        return value

    def options_display(self, field_type: FieldType, mode: FieldMode, options: list) -> list[str]:
        if field_type == FieldType.ENUM or mode != FieldMode.CHOICE:
            return [str(o) for o in options]
        out = []
        for o in options:
            shown = self.display(field_type, [o] if field_type == FieldType.MANAGERS else o)
            out.append(str(shown[0] if isinstance(shown, list) else shown))
        return out


def _doc_brief(d: Document) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "is_file": d.is_file,
        "url": d.url,
        "content_type": d.content_type,
        "size_bytes": d.size_bytes,
    }
