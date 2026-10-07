from __future__ import annotations

from lattice_core.db.models import Item
from lattice_core.domain.fields import is_empty
from lattice_core.schemas.common import CatalogRef, ItemRef, LocationRef, UserRef
from lattice_core.schemas.documents import DocumentOut
from lattice_core.schemas.items import (
    CompositionRow,
    ExtraOut,
    ItemDetail,
    ItemFieldOut,
    ItemRow,
    StateEntry,
)
from lattice_core.schemas.locations import LocationOut
from lattice_core.services.base import Services
from lattice_core.services.hierarchy import composition, missing_children
from lattice_core.services.item_values import effective_value
from lattice_core.views.templates import template_ref


def item_ref(i: Item) -> ItemRef:
    return ItemRef(id=i.id, type=i.type, template_id=i.template_id, name=i.name,
                   serial=i.serial, state=i.state, card_type=i.card_type)


def _catalog(o) -> CatalogRef | None:
    return CatalogRef(id=o.id, value=o.value) if o is not None else None


def item_row(i: Item) -> ItemRow:
    return ItemRow(
        id=i.id,
        type=i.type,
        template=template_ref(i.template),
        name=i.name,
        serial=i.serial,
        state=i.state,
        card_type=i.card_type,
        quantity=i.quantity,
        storage=i.storage_status,
        parent=item_ref(i.parent) if i.parent else None,
        location=LocationRef.model_validate(i.location) if i.location else None,
        industry=_catalog(i.industry),
        project=_catalog(i.project),
        team=_catalog(i.team),
        managers=[UserRef.model_validate(m) for m in i.managers],
        children_count=len(i.children),
        missing_children=missing_children(i),
        updated_at=i.updated_at,
    )


def item_detail(s: Services, i: Item) -> ItemDetail:
    v = s.values
    fields = []
    for f in i.template.fields:
        value = effective_value(s.uow, i, f)
        fields.append(ItemFieldOut(
            field_id=f.id, key=f.key, label=f.label, field_type=f.field_type, mode=f.mode,
            required=f.required, config=f.config or {}, value=value,
            display=v.display(f.field_type, value),
            missing=f.required and is_empty(value),
        ))
    comp = [
        CompositionRow(
            template=template_ref(link.child),
            min_count=fill.slot.min_count,
            max_count=fill.slot.max_count,
            count=fill.count,
            missing=fill.missing,
            is_full=fill.is_full,
        )
        for link, fill in zip(i.template.child_links, composition(i), strict=True)
    ]
    location_detail = None
    if i.location is not None:
        location_detail = LocationOut.model_validate(i.location)
    return ItemDetail(
        **item_row(i).model_dump(),
        tracking=i.template.tracking,
        location_detail=location_detail,
        ancestors=[item_ref(a) for a in i.ancestors()],
        children=[item_ref(c) for c in i.children],
        responsible=UserRef.model_validate(i.responsible) if i.responsible else None,
        fields=fields,
        state_history=[
            StateEntry(id=h.id, state=h.state, note=h.note,
                       changed_by_name=h.user.full_name if h.user else None,
                       changed_at=h.changed_at)
            for h in i.state_history
        ],
        documents=[DocumentOut.model_validate(d) for d in i.documents if d.field_id is None],
        extras=[ExtraOut.model_validate(e) for e in i.extras],
        composition=comp,
        is_complete=not any(r.missing for r in comp),
        allowed_parent_templates=[template_ref(p) for p in i.template.parent_templates],
        created_at=i.created_at,
    )
