"""Templates: the blueprints every item is made from.

**An edit reaches every item made from the template.** A fixed free-form value
is read through the template, so changing it changes every item at once. A
fixed *system* value (catalog values, responsible, managers) also lives in real
columns of the items, and is rewritten there in the same transaction — e.g.
fixing a new manager on a template moves every one of its items under that
manager. Switching a field from fixed to per-item keeps, on every item, the
value it showed until then.
"""

from __future__ import annotations

from typing import Any

from lattice_core.db.models import ItemFieldValue, ItemTemplate, TemplateChild, TemplateField
from lattice_core.domain.enums import (
    PROPAGATED_FIELD_TYPES,
    CardType,
    FieldMode,
    FieldType,
    ItemType,
    card_tracking,
)
from lattice_core.domain.errors import Conflict, Issue, RuleViolation, ValidationFailed
from lattice_core.domain.fields import FieldSpec
from lattice_core.domain.hierarchy import can_contain
from lattice_core.domain.permissions import Permission
from lattice_core.domain.serials import format_serial, next_number, normalize_prefix, series_head
from lattice_core.schemas.templates import ChildSlotIn, TemplateCreate, TemplateUpdate
from lattice_core.services.base import Service
from lattice_core.services.field_specs import normalize_fields
from lattice_core.services.item_values import write_system_value


class TemplateService(Service):
    # ─────────────────────────── queries ───────────────────────────
    def list(self, *, type: ItemType | None = None, card_type: CardType | None = None,
             search: str | None = None) -> list[ItemTemplate]:
        self.services.require(Permission.READ)
        return self.uow.templates.list(type=type, card_type=card_type, search=search)

    def get(self, template_id: int) -> ItemTemplate:
        self.services.require(Permission.READ)
        return self.uow.templates.require(template_id)

    def next_serial(self, tpl: ItemTemplate) -> str:
        head = series_head(tpl.type, tpl.serial_prefix)
        return format_serial(tpl.type, tpl.serial_prefix,
                             next_number(self.uow.items.serials_like(head)))

    # ─────────────────────────── create ───────────────────────────
    def create(self, cmd: TemplateCreate) -> ItemTemplate:
        self.services.require(Permission.WRITE_TEMPLATES)
        with self.uow.transaction():
            card_type = _check_card_type(cmd.type, cmd.card_type)
            tpl = ItemTemplate(
                type=cmd.type,
                name=self._check_name(cmd.type, cmd.name, None),
                card_type=card_type,
                serial_prefix=self._check_prefix(cmd.type, cmd.serial_prefix, None),
                description=_clean(cmd.description),
                created_by=self.actor.id,
            )
            specs = normalize_fields(self.services.values, cmd.fields, item_type=cmd.type,
                                     card_type=card_type)
            if any(s.id is not None for s in specs):
                raise RuleViolation("A new template's fields cannot refer to existing field ids")
            for spec in specs:
                tpl.fields.append(_new_field(spec))
            slots = self._resolve_slots(cmd.type, cmd.children, None)
            for position, (child, lo, hi) in enumerate(slots):
                tpl.child_links.append(TemplateChild(child=child, min_count=lo, max_count=hi,
                                                     position=position))
            self.uow.templates.add(tpl)
            self.uow.session.flush()

            copied = 0
            for spec, field in zip(specs, tpl.fields, strict=True):
                if (spec.copy_files_from and field.field_type == FieldType.FILES
                        and field.mode == FieldMode.FIXED):
                    copied += self.services.documents.copy_field_files(spec.copy_files_from, field)

            details: dict[str, Any] = {
                "fields": [s.label for s in specs],
                "children": [{"template_id": c.id, "min_count": lo, "max_count": hi}
                             for c, lo, hi in slots],
            }
            if cmd.source_template_id:
                details["source_template_id"] = cmd.source_template_id
            if copied:
                details["files_copied"] = copied
            self.audit.record(
                "template.create",
                f"Created {tpl.type.value} template '{tpl.name}' ({tpl.serial_prefix})",
                template=tpl,
                details=details,
            )
            return tpl

    # ─────────────────────────── update ───────────────────────────
    def update(self, template_id: int, cmd: TemplateUpdate) -> ItemTemplate:  # noqa: C901
        self.services.require(Permission.WRITE_TEMPLATES)
        with self.uow.transaction():
            tpl = self.uow.templates.require(template_id)
            changes: dict[str, Any] = {}

            if cmd.name is not None:
                name = self._check_name(tpl.type, cmd.name, tpl.id)
                if name != tpl.name:
                    changes["name"] = [tpl.name, name]
                    tpl.name = name
            if cmd.serial_prefix is not None:
                prefix = self._check_prefix(tpl.type, cmd.serial_prefix, tpl.id)
                if prefix != tpl.serial_prefix:
                    # Existing items keep their serials (it's the label on the
                    # board); new items use the new prefix.
                    changes["serial_prefix"] = [tpl.serial_prefix, prefix]
                    tpl.serial_prefix = prefix
            if "description" in cmd.model_fields_set:
                desc = _clean(cmd.description)
                if desc != tpl.description:
                    changes["description"] = True
                    tpl.description = desc
            if cmd.card_type is not None:
                self._change_card_type(tpl, cmd.card_type, changes)

            affected = 0
            if cmd.fields is not None:
                affected = self._update_fields(tpl, cmd, changes)
            if cmd.children is not None:
                self._update_children(tpl, cmd.children, changes)

            self.uow.session.flush()
            if changes:
                self.audit.record(
                    "template.update",
                    f"Updated template '{tpl.name}' ({', '.join(changes)})"
                    + (f" — applied to {affected} item(s)" if affected else ""),
                    template=tpl,
                    details={"changes": changes, "items_affected": affected},
                )
            return tpl

    def _change_card_type(self, tpl: ItemTemplate, card_type: CardType, changes: dict) -> None:
        new = _check_card_type(tpl.type, card_type)
        if new == tpl.card_type:
            return
        if card_tracking(new) != card_tracking(tpl.card_type):
            many = self.uow.templates.multi_unit_items(tpl.id)
            if many:
                raise RuleViolation(
                    f"{many} item(s) of '{tpl.name}' hold more than one unit; a {new.value} "
                    "card is tracked one unit per serial"
                )
            if any(f.field_type == FieldType.QUANTITY for f in tpl.fields):
                raise RuleViolation("Remove the quantity field before leaving the commercial type")
        changes["card_type"] = [tpl.card_type.value if tpl.card_type else None, new.value]
        tpl.card_type = new

    def _update_fields(self, tpl: ItemTemplate, cmd: TemplateUpdate, changes: dict) -> int:  # noqa: C901
        existing = {f.id: f for f in tpl.fields}
        specs = normalize_fields(self.services.values, cmd.fields or [], item_type=tpl.type,
                                 card_type=tpl.card_type, existing=existing)
        kept = {s.id for s in specs if s.id is not None}
        items = self.uow.templates.items_of(tpl.id)
        affected = 0

        for fid, f in existing.items():
            if fid in kept:
                continue
            if f.field_type in PROPAGATED_FIELD_TYPES:
                # A removed system field stops describing the items.
                self._propagate(items, f.field_type,
                                [] if f.field_type == FieldType.MANAGERS else None)
            for doc in self.uow.documents.of_field(f.id):
                self.services.documents.delete(doc)
            changes.setdefault("removed_fields", []).append(f.label)
            tpl.fields.remove(f)
        self.uow.session.flush()

        for spec in specs:
            if spec.id is None:
                f = _new_field(spec)
                tpl.fields.append(f)
                self.uow.session.flush()
                changes.setdefault("added_fields", []).append(f.label)
                if f.mode == FieldMode.FIXED and f.field_type in PROPAGATED_FIELD_TYPES:
                    affected = max(affected, self._propagate(items, f.field_type, f.fixed_value))
                continue

            f = existing[spec.id]
            was_fixed, before_value = f.mode == FieldMode.FIXED, f.fixed_value
            if (f.field_type == FieldType.FILES and f.mode != spec.mode
                    and FieldMode.FIXED in (f.mode, spec.mode)
                    and self.uow.documents.of_field(f.id)):
                raise RuleViolation(
                    f"'{f.label}' already has files; remove them before switching it between "
                    "a template value and a per-item value"
                )
            diff = [k for k in ("key", "label", "mode", "required", "position", "config",
                                "fixed_value") if getattr(f, k) != getattr(spec, k)]
            for k in diff:
                setattr(f, k, getattr(spec, k))
            if set(diff) - {"position"}:
                changes.setdefault("changed_fields", []).append(f.label)

            now_fixed = f.mode == FieldMode.FIXED
            if now_fixed and (not was_fixed or before_value != f.fixed_value):
                if f.field_type in PROPAGATED_FIELD_TYPES:
                    affected = max(affected, self._propagate(items, f.field_type, f.fixed_value))
                elif f.field_type != FieldType.FILES:
                    # The template's value now speaks for every item.
                    for item in items:
                        row = item.own_value(f.id)
                        if row is not None:
                            item.field_values.remove(row)
                    affected = max(affected, len(items))
            elif (was_fixed and not now_fixed and f.field_type not in PROPAGATED_FIELD_TYPES
                  and f.field_type != FieldType.FILES and before_value is not None):
                # Keep what every item showed until now as its own value.
                for item in items:
                    item.field_values.append(ItemFieldValue(field_id=f.id, value=before_value))

        tpl.fields.sort(key=lambda f: f.position)
        return affected

    def _propagate(self, items, field_type: FieldType, value) -> int:
        for item in items:
            write_system_value(self.uow, item, field_type, value)
        return len(items)

    def _update_children(self, tpl: ItemTemplate, entries: list[ChildSlotIn],
                         changes: dict) -> None:
        wanted = self._resolve_slots(tpl.type, entries, tpl.id)
        current = {link.child_template_id: link for link in tpl.child_links}
        after = {c.id for c, _, _ in wanted}

        for removed_id, link in current.items():
            if removed_id in after:
                continue
            inside = self.uow.templates.items_inside(tpl.id, removed_id)
            if inside:
                raise Conflict(
                    f"{inside} item(s) of '{link.child.name}' currently sit inside items of "
                    f"'{tpl.name}' — unlink them before removing that template from the list"
                )
        for child, _lo, hi in wanted:
            if hi is None:
                continue
            fullest = self.uow.templates.fullest_container(tpl.id, child.id)
            if fullest > hi:
                raise Conflict(
                    f"An item of '{tpl.name}' already holds {fullest} × '{child.name}' — unlink "
                    f"some before lowering the maximum to {hi}"
                )

        before = {tid: [lk.min_count, lk.max_count] for tid, lk in current.items()}
        for removed_id, link in current.items():
            if removed_id not in after:
                tpl.child_links.remove(link)
        for position, (child, lo, hi) in enumerate(wanted):
            link = current.get(child.id)
            if link is None:
                tpl.child_links.append(TemplateChild(child=child, min_count=lo, max_count=hi,
                                                     position=position))
            else:
                link.min_count, link.max_count, link.position = lo, hi, position
        tpl.child_links.sort(key=lambda lk: lk.position)
        now = {c.id: [lo, hi] for c, lo, hi in wanted}
        if now != before:
            changes["children"] = {
                "before": {str(k): v for k, v in before.items()},
                "after": {str(k): v for k, v in now.items()},
            }

    # ─────────────────────────── delete ───────────────────────────
    def delete(self, template_id: int) -> None:
        self.services.require(Permission.WRITE_TEMPLATES)
        with self.uow.transaction():
            tpl = self.uow.templates.require(template_id)
            count = self.uow.templates.item_count(tpl.id)
            if count:
                raise Conflict(
                    f"'{tpl.name}' still has {count} item(s); a template can only be deleted "
                    "once nothing was made from it"
                )
            for doc in self.uow.documents.of_template(tpl.id):
                self.services.documents.delete(doc)
            threshold = self.uow.thresholds.for_template(tpl.id)
            if threshold is not None:
                self.uow.thresholds.delete(threshold)
            self.audit.record(
                "template.delete",
                f"Deleted {tpl.type.value} template '{tpl.name}'",
                details={"template_id": tpl.id, "name": tpl.name},
            )
            self.uow.templates.delete(tpl)

    # ─────────────────────────── checks ───────────────────────────
    def _check_name(self, type: ItemType, name: str, exclude_id: int | None) -> str:
        clean = (name or "").strip()
        if not clean:
            raise RuleViolation("A template needs a name")
        clash = self.uow.templates.name_clash(type, clean, exclude_id)
        if clash:
            raise Conflict(
                f"A {type.value} template named '{clash.name}' already exists — each named "
                "card, assembly or setup has exactly one template"
            )
        return clean

    def _check_prefix(self, type: ItemType, prefix: str, exclude_id: int | None) -> str:
        value = normalize_prefix(prefix)
        clash = self.uow.templates.prefix_clash(type, value, exclude_id)
        if clash:
            raise Conflict(
                f"The serial prefix '{value}' is already used by the {type.value} template "
                f"'{clash.name}'"
            )
        return value

    def _resolve_slots(self, type: ItemType, entries: list[ChildSlotIn], self_id: int | None):
        out: list[tuple[ItemTemplate, int, int | None]] = []
        seen: set[int] = set()
        issues: list[Issue] = []
        for i, entry in enumerate(entries):
            if entry.template_id in seen:
                continue
            seen.add(entry.template_id)
            child = self.uow.templates.get(entry.template_id)
            path = f"children.{i}"
            if child is None:
                issues.append(Issue(f"template #{entry.template_id} no longer exists", field=path))
                continue
            if child.id == self_id:
                issues.append(Issue("a template cannot contain itself", field=path,
                                    label=child.name))
                continue
            if not can_contain(type, child.type):
                issues.append(Issue(f"a {type.value} template cannot contain "
                                    f"{child.type.value} templates", field=path, label=child.name))
                continue
            if entry.max_count is not None and entry.max_count < entry.min_count:
                issues.append(Issue(f"the maximum ({entry.max_count}) is below the minimum "
                                    f"({entry.min_count})", field=path, label=child.name))
                continue
            out.append((child, entry.min_count, entry.max_count))
        if issues:
            raise ValidationFailed.from_issues(issues)
        return out


def _check_card_type(type: ItemType, card_type: CardType | None) -> CardType | None:
    if type == ItemType.CARD:
        if card_type is None:
            raise RuleViolation(
                "A card template needs a card type (copied / house / white / factory / commercial)"
            )
        return card_type
    if card_type is not None:
        raise RuleViolation("Only card templates have a card type")
    return None


def _new_field(spec: FieldSpec) -> TemplateField:
    return TemplateField(
        key=spec.key, label=spec.label, field_type=spec.field_type, mode=spec.mode,
        required=spec.required, position=spec.position, config=spec.config,
        fixed_value=spec.fixed_value,
    )


def _clean(text: str | None) -> str | None:
    return (text or "").strip() or None
