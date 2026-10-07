"""Validating the field list a template author (or a field group) defines.

Every problem in the list is collected and reported at once, each pinned to
its field, so the editor can mark all of them in one round trip.
"""

from __future__ import annotations

from typing import Any

from lattice_core.db.models import TemplateField
from lattice_core.domain.enums import (
    SYSTEM_FIELD_TYPES,
    CardType,
    FieldMode,
    FieldType,
    ItemType,
)
from lattice_core.domain.errors import Issue, ValidationFailed
from lattice_core.domain.fields import (
    DEFAULT_DESCRIPTION_MIN,
    FieldSpec,
    InvalidValue,
    is_empty,
    make_key,
    structural_problem,
)
from lattice_core.schemas.templates import FieldIn
from lattice_core.services.field_values import FieldValues


class _FieldProblem(Exception):
    pass


def normalize_fields(
    values: FieldValues,
    specs: list[FieldIn],
    *,
    item_type: ItemType,
    card_type: CardType | None,
    existing: dict[int, TemplateField] | None = None,
) -> list[FieldSpec]:
    existing = existing or {}
    issues: list[Issue] = []
    out: list[FieldSpec] = []
    keys: set[str] = set()
    labels: set[str] = set()
    system_seen: set[FieldType] = set()

    for position, spec in enumerate(specs):
        label = spec.label.strip()
        path = f"fields.{position}"

        def problem(message: str, path: str = path, label: str = label or f"#{position + 1}"):
            issues.append(Issue(message=message, field=path, label=label))

        if not label:
            problem("a field needs a name")
            continue
        if label.lower() in labels:
            problem(f"two fields are named '{label}'")
            continue
        labels.add(label.lower())

        if spec.id is not None:
            current = existing.get(spec.id)
            if current is None:
                problem(f"field #{spec.id} is not part of this template")
                continue
            if current.field_type != spec.field_type:
                problem("a field's type cannot change once it exists — remove it and add a "
                        "new field instead")
                continue

        reason = structural_problem(spec.field_type, spec.mode, item_type=item_type,
                                    card_type=card_type)
        if reason:
            problem(reason)
            continue
        if spec.field_type in SYSTEM_FIELD_TYPES:
            if spec.field_type in system_seen:
                problem(f"a template can have only one {spec.field_type.value} field")
                continue
            system_seen.add(spec.field_type)

        try:
            config = _config(values, spec.field_type, spec.mode, spec.config)
            fixed_value = None
            if spec.mode == FieldMode.FIXED and spec.field_type != FieldType.FILES:
                try:
                    fixed_value = values.coerce(spec.field_type, spec.fixed_value, config)
                except InvalidValue as exc:
                    raise _FieldProblem(str(exc)) from None
                if spec.required and is_empty(fixed_value):
                    raise _FieldProblem("a required template field needs its value")
        except _FieldProblem as exc:
            problem(str(exc))
            continue

        key = (spec.key or "").strip() or (existing[spec.id].key if spec.id is not None else "")
        if not key or key in keys:
            key = make_key(label, keys)
        keys.add(key)

        out.append(FieldSpec(
            id=spec.id,
            key=key,
            label=label,
            field_type=spec.field_type,
            mode=spec.mode,
            required=spec.required,
            position=position,
            config=config,
            fixed_value=fixed_value,
            copy_files_from=spec.copy_files_from,
        ))

    if issues:
        raise ValidationFailed.from_issues(issues)
    return out


def _config(values: FieldValues, field_type: FieldType, mode: FieldMode,
            config: dict[str, Any]) -> dict:
    clean: dict[str, Any] = {}

    if field_type in (FieldType.STRING, FieldType.SERIAL_STRING) and config.get("pattern"):
        pattern = str(config["pattern"]).strip()
        if "#" not in pattern:
            raise _FieldProblem("a format needs at least one # (a digit to type)")
        clean["pattern"] = pattern

    if field_type == FieldType.DESCRIPTION:
        try:
            minimum = int(config.get("min_length") or DEFAULT_DESCRIPTION_MIN)
        except (TypeError, ValueError):
            raise _FieldProblem("the minimum length must be a number") from None
        if minimum < 1:
            raise _FieldProblem("the minimum length must be at least 1")
        clean["min_length"] = minimum

    if field_type == FieldType.ENUM:
        options = [str(o).strip() for o in config.get("options") or [] if str(o).strip()]
        if not options:
            raise _FieldProblem("a fixed list needs at least one value")
        if len(set(options)) != len(options):
            raise _FieldProblem("the list repeats a value")
        clean["options"] = options
    elif mode == FieldMode.CHOICE:
        raw = config.get("options") or []
        if not raw:
            raise _FieldProblem("a list field needs at least one value — the first is the default")
        options: list[Any] = []
        for o in raw:
            try:
                coerced = values.coerce(field_type, o, clean)
            except InvalidValue as exc:
                raise _FieldProblem(f"list value '{o}': {exc}") from None
            # A managers list offers individual managers to pick from.
            for v in coerced if isinstance(coerced, list) else [coerced]:
                if v not in options:
                    options.append(v)
        clean["options"] = options
    return clean
