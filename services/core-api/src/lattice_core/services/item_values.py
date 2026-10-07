"""Reading and writing the values of an item's fields.

A field's value can live in three places — on the template (fixed fields), in
a real column of the item (system types), or in ``item_field_values`` (the
rest). This module is the one place that knows which, so nothing else has to.
"""

from __future__ import annotations

from typing import Any

from lattice_core.db.models import Item, ItemFieldValue, ItemTemplate, TemplateField
from lattice_core.domain.enums import (
    ACTION_ONLY_FIELD_TYPES,
    SYSTEM_FIELD_TYPES,
    FieldMode,
    FieldType,
    ItemState,
)
from lattice_core.domain.errors import Issue, ValidationFailed
from lattice_core.domain.fields import InvalidValue, check_in_options, default_value, is_empty
from lattice_core.services.field_values import FieldValues
from lattice_core.services.uow import UnitOfWork


def write_system_value(uow: UnitOfWork, item: Item, field_type: FieldType, value: Any) -> None:
    match field_type:
        case FieldType.INDUSTRY:
            item.industry_id = value
        case FieldType.PROJECT:
            item.project_id = value
        case FieldType.TEAM:
            item.team_id = value
        case FieldType.RESPONSIBLE:
            item.responsible_id = value
        case FieldType.MANAGERS:
            item.managers = uow.users.get_many(value or [])
        case FieldType.STATUS:
            item.state = ItemState(value) if value else ItemState.BUILT
        case FieldType.QUANTITY:
            item.quantity = value or 1
        case FieldType.LOCATION:
            item.location_id = value
        case FieldType.PARENT:
            pass  # applied through the hierarchy service (link rules, cascades)


def read_system_value(item: Item, field_type: FieldType) -> Any:
    match field_type:
        case FieldType.INDUSTRY:
            return item.industry_id
        case FieldType.PROJECT:
            return item.project_id
        case FieldType.TEAM:
            return item.team_id
        case FieldType.RESPONSIBLE:
            return item.responsible_id
        case FieldType.MANAGERS:
            return sorted(m.id for m in item.managers)
        case FieldType.STATUS:
            return item.state.value
        case FieldType.QUANTITY:
            return item.quantity
        case FieldType.LOCATION:
            return item.location_id
        case FieldType.PARENT:
            return item.parent_id
    raise ValueError(field_type)  # pragma: no cover


def effective_value(uow: UnitOfWork, item: Item, field: TemplateField) -> Any:
    """What this item shows for a field: the template's, a column, or its own."""
    if field.field_type == FieldType.FILES:
        if field.mode == FieldMode.FIXED:
            docs = uow.documents.of_field(field.id, template_id=field.template_id)
        else:
            docs = uow.documents.of_field(field.id, item_id=item.id)
        return [d.id for d in docs]
    if field.field_type in SYSTEM_FIELD_TYPES:
        return read_system_value(item, field.field_type)
    if field.mode == FieldMode.FIXED:
        return field.fixed_value
    row = item.own_value(field.id)
    return row.value if row else None


def write_own_value(item: Item, field: TemplateField, value: Any) -> None:
    """Store a free-form value in ``item_field_values`` (empty → no row)."""
    row = item.own_value(field.id)
    if is_empty(value):
        if row is not None:
            item.field_values.remove(row)
        return
    if row is None:
        item.field_values.append(ItemFieldValue(field_id=field.id, value=value))
    else:
        row.value = value


def resolve_supplied(
    values: FieldValues,
    template: ItemTemplate,
    supplied: dict[str, Any],
    *,
    creating: bool,
) -> dict[int, Any]:
    """Validate supplied ``{key: value}`` against the template → ``{field_id: value}``.

    Every problem is collected, so a form (or a spreadsheet row) can show them
    all at once.
    """
    by_key = {f.key: f for f in template.fields}
    issues = [
        Issue(message=f"'{k}' is not a field of '{template.name}'", field=k)
        for k in supplied
        if k not in by_key
    ]
    out: dict[int, Any] = {}

    for f in template.fields:
        present = f.key in supplied

        def fail(message: str, f: TemplateField = f) -> None:
            issues.append(Issue(message=message, field=f.key, label=f.label))

        if f.mode == FieldMode.FIXED:
            if present:
                fail("is set on the template and cannot be changed per item")
            continue
        if not creating and not present:
            continue
        if not creating and f.field_type in ACTION_ONLY_FIELD_TYPES:
            fail(f"use the '{ACTION_ONLY_FIELD_TYPES[f.field_type]}' action to change it")
            continue
        try:
            value = values.coerce(f.field_type, supplied.get(f.key), f.config)
            if is_empty(value) and creating:
                value = default_value(f.mode, f.field_type, f.config, f.fixed_value)
            if not is_empty(value):
                check_in_options(f.mode, f.field_type, f.config, value)
        except InvalidValue as exc:
            fail(str(exc))
            continue
        if f.required and is_empty(value):
            fail("is required")
            continue
        out[f.id] = value

    if issues:
        raise ValidationFailed.from_issues(issues)
    return out
