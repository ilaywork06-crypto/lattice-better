from __future__ import annotations

from collections import defaultdict

from lattice_core.db.models import FieldGroup, ItemTemplate
from lattice_core.repositories.templates import StateCounts
from lattice_core.schemas.common import TemplateRef
from lattice_core.schemas.documents import DocumentOut
from lattice_core.schemas.templates import (
    ChildSlotOut,
    FieldGroupFieldOut,
    FieldGroupOut,
    FieldOut,
    StateCountsOut,
    TemplateDetail,
    TemplateSummary,
)
from lattice_core.services.base import Services


def template_ref(t: ItemTemplate) -> TemplateRef:
    return TemplateRef.model_validate(t)


def _counts(c: StateCounts | None) -> StateCountsOut:
    if c is None:
        return StateCountsOut()
    return StateCountsOut(built=c.built, ok=c.ok, faulty=c.faulty, destroyed=c.destroyed,
                          total=c.total)


def template_summary(t: ItemTemplate, counts: StateCounts | None) -> TemplateSummary:
    return TemplateSummary(
        **template_ref(t).model_dump(),
        tracking=t.tracking,
        description=t.description,
        counts=_counts(counts),
        field_count=len(t.fields),
        child_template_ids=[link.child_template_id for link in t.child_links],
        parent_template_ids=[link.parent_template_id for link in t.parent_links],
        updated_at=t.updated_at,
    )


def template_summaries(s: Services, templates: list[ItemTemplate]) -> list[TemplateSummary]:
    counts = s.uow.templates.state_counts([t.id for t in templates])
    return [template_summary(t, counts.get(t.id)) for t in templates]


def template_detail(s: Services, t: ItemTemplate) -> TemplateDetail:
    counts = s.uow.templates.state_counts([t.id]).get(t.id)
    files = defaultdict(list)
    for d in s.uow.documents.of_template(t.id):
        if d.field_id is not None:
            files[d.field_id].append(DocumentOut.model_validate(d))
    v = s.values
    return TemplateDetail(
        **template_summary(t, counts).model_dump(),
        fields=[
            FieldOut(
                id=f.id, key=f.key, label=f.label, field_type=f.field_type, mode=f.mode,
                required=f.required, position=f.position, config=f.config or {},
                fixed_value=f.fixed_value,
                fixed_display=v.display(f.field_type, f.fixed_value),
                options_display=v.options_display(f.field_type, f.mode, f.options),
                files=files.get(f.id, []),
            )
            for f in t.fields
        ],
        children=[
            ChildSlotOut(template=template_ref(link.child), min_count=link.min_count,
                         max_count=link.max_count)
            for link in t.child_links
        ],
        parents=[template_ref(p) for p in t.parent_templates],
        next_serial=s.templates.next_serial(t),
        created_at=t.created_at,
    )


def field_group_out(s: Services, g: FieldGroup) -> FieldGroupOut:
    v = s.values
    return FieldGroupOut(
        id=g.id,
        name=g.name,
        description=g.description,
        fields=[
            FieldGroupFieldOut(
                key=f.key, label=f.label, field_type=f.field_type, mode=f.mode,
                required=f.required, position=f.position, config=f.config or {},
                fixed_value=f.fixed_value,
                fixed_display=v.display(f.field_type, f.fixed_value),
                options_display=v.options_display(f.field_type, f.mode, f.options),
            )
            for f in g.fields
        ],
        created_at=g.created_at,
        updated_at=g.updated_at,
    )
