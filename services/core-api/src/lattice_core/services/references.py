"""Template fields keep user/location/catalog ids inside JSON (fixed values and
list options), where a foreign key can't reach. When such a row is deleted,
these helpers drop it from every template field and field group."""

from __future__ import annotations

from lattice_core.domain.enums import FieldMode, FieldType
from lattice_core.services.uow import UnitOfWork


def forget_reference(uow: UnitOfWork, field_types: set[FieldType], ref_id: int) -> None:
    fields = [*uow.templates.fields_of_types(field_types),
              *uow.field_groups.fields_of_types(field_types)]
    for f in fields:
        options = (f.config or {}).get("options")
        if options and ref_id in options:
            f.config = {**f.config, "options": [o for o in options if o != ref_id]}
        if f.mode == FieldMode.FIXED:
            if f.fixed_value == ref_id:
                f.fixed_value = None
            elif isinstance(f.fixed_value, list) and ref_id in f.fixed_value:
                f.fixed_value = [v for v in f.fixed_value if v != ref_id]


def template_names_using(uow: UnitOfWork, field_type: FieldType, ref_id: int) -> list[str]:
    names = set()
    for f in uow.templates.fields_of_types({field_type}):
        listed = ref_id in ((f.config or {}).get("options") or [])
        fixed = f.mode == FieldMode.FIXED and (
            f.fixed_value == ref_id
            or (isinstance(f.fixed_value, list) and ref_id in f.fixed_value)
        )
        if listed or fixed:
            names.add(f.template.name)
    return sorted(names)
