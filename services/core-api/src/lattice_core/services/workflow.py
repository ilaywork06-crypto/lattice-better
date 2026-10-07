"""The change-request workflow.

Editors don't mutate items or templates directly — they *propose* a change
with a reason; viewers may propose a location change only. Each action is
described once in ``ACTIONS``: the command its payload must be, what it targets,
how to word it, and which use case applies it. The payload is validated when
the proposal is **submitted**, so a malformed proposal never reaches a manager;
on approval the very same use case a manager would call runs, as the reviewer,
inside the approval's transaction.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import BaseModel

from lattice_core.db.models import ChangeRequest, Item, ItemTemplate
from lattice_core.domain.enums import ChangeAction, ChangeStatus, UserRole
from lattice_core.domain.errors import PermissionDenied, RuleViolation
from lattice_core.domain.permissions import Permission, can_propose
from lattice_core.schemas.items import (
    DeleteCommand,
    ItemCreate,
    ItemUpdate,
    LinkCommand,
    MoveCommand,
    StateCommand,
    UnlinkCommand,
)
from lattice_core.schemas.templates import TemplateCreate, TemplateUpdate
from lattice_core.schemas.workflow import ChangeRequestCreate
from lattice_core.services.base import Service, Services, parse_command
from lattice_shared.events import Event, EventType, Recipient


@dataclass(frozen=True, slots=True)
class Target:
    item: Item | None = None
    template: ItemTemplate | None = None

    @property
    def name(self) -> str | None:
        if self.item is not None:
            return self.item.label
        return self.template.name if self.template is not None else None


@dataclass(frozen=True, slots=True)
class ActionSpec:
    command: type[BaseModel]
    target: str  # "item" | "template" | "none"
    describe: Callable[[Services, Target, BaseModel], str]
    apply: Callable[[Services, ChangeRequest, BaseModel], object]


def _describe_update(s: Services, t: Target, cmd: ItemUpdate) -> str:
    labels = {f.key: f.label for f in t.item.template.fields} if t.item else {}
    changed = [labels.get(k, k) for k in cmd.values]
    if cmd.serial:
        changed.append("serial")
    return f"Edit '{t.name}'" + (f" ({', '.join(changed)})" if changed else "")


def _location_name(s: Services, location_id: int | None) -> str:
    loc = s.uow.locations.get(location_id)
    return loc.name if loc else "another location"


ACTIONS: dict[ChangeAction, ActionSpec] = {
    ChangeAction.CREATE: ActionSpec(
        ItemCreate, "none",
        lambda s, t, c: f"Create a new '{s.uow.templates.require(c.template_id).name}'",
        lambda s, cr, c: s.items.create(c),
    ),
    ChangeAction.UPDATE: ActionSpec(
        ItemUpdate, "item", _describe_update,
        lambda s, cr, c: s.items.update(cr.item_id, c),
    ),
    ChangeAction.DELETE: ActionSpec(
        DeleteCommand, "item",
        lambda s, t, c: f"Delete '{t.name}'",
        lambda s, cr, c: s.items.delete(cr.item_id),
    ),
    ChangeAction.MOVE: ActionSpec(
        MoveCommand, "item",
        lambda s, t, c: f"Move '{t.name}' to {_location_name(s, c.location_id)}",
        lambda s, cr, c: s.hierarchy.move(cr.item_id, c),
    ),
    ChangeAction.LINK: ActionSpec(
        LinkCommand, "item",
        lambda s, t, c: f"Place '{t.name}' inside {s.uow.items.require(c.parent_id).label}",
        lambda s, cr, c: s.hierarchy.link(cr.item_id, c),
    ),
    ChangeAction.UNLINK: ActionSpec(
        UnlinkCommand, "item",
        lambda s, t, c: f"Take '{t.name}' out of its container"
        + (f" to {_location_name(s, c.location_id)}" if c.location_id else ""),
        lambda s, cr, c: s.hierarchy.unlink(cr.item_id, c),
    ),
    ChangeAction.STATE_CHANGE: ActionSpec(
        StateCommand, "item",
        lambda s, t, c: f"Change the state of '{t.name}' to {c.state.value}",
        lambda s, cr, c: s.items.change_state(cr.item_id, c),
    ),
    ChangeAction.TEMPLATE_CREATE: ActionSpec(
        TemplateCreate, "none",
        lambda s, t, c: f"Create the {c.type.value} template '{c.name}'",
        lambda s, cr, c: s.templates.create(c),
    ),
    ChangeAction.TEMPLATE_UPDATE: ActionSpec(
        TemplateUpdate, "template",
        lambda s, t, c: f"Edit the template '{t.name}'",
        lambda s, cr, c: s.templates.update(cr.template_id, c),
    ),
}


class WorkflowService(Service):
    # ─────────────────────────── queries ───────────────────────────
    def page(self, *, status: ChangeStatus | None, mine: bool, limit: int, offset: int):
        self.services.require(Permission.READ)
        return self.uow.change_requests.page(
            status=status, proposed_by=self.actor.id if mine else None, limit=limit, offset=offset
        )

    def get(self, cr_id: int) -> ChangeRequest:
        self.services.require(Permission.READ)
        return self.uow.change_requests.require(cr_id)

    # ─────────────────────────── submit ───────────────────────────
    def submit(self, data: ChangeRequestCreate) -> ChangeRequest:
        user = self.services.require(Permission.PROPOSE_CHANGES)
        if not can_propose(user.role, data.action):
            raise PermissionDenied(
                "Viewers can propose a location change only"
                if user.role == UserRole.VIEWER
                else f"You cannot propose a '{data.action.value}' change"
            )
        spec = ACTIONS[data.action]
        command = parse_command(spec.command, data.payload, "proposal")
        with self.uow.transaction():
            target = self._target(spec, data)
            item_type = (
                target.item.type if target.item
                else target.template.type if target.template
                else getattr(command, "type", None)
            )
            target_name = target.name or getattr(command, "name", None)
            if data.action == ChangeAction.CREATE:
                template = self.uow.templates.require(command.template_id)
                item_type, target_name = template.type, template.name
            cr = ChangeRequest(
                action=data.action,
                item_id=target.item.id if target.item else None,
                template_id=target.template.id if target.template else None,
                item_type=item_type,
                target_name=target_name,
                payload=command.model_dump(mode="json", exclude_unset=True),
                description=spec.describe(self.services, target, command),
                reason=data.reason.strip(),
                proposed_by=user.id,
                status=ChangeStatus.PENDING,
            )
            self.uow.change_requests.add(cr)
            self.uow.session.flush()
            self.audit.record(
                "change_request.submit",
                f"{user.full_name} proposed: {cr.description}",
                item=target.item,
                template=target.template,
                details={"change_request_id": cr.id, "reason": cr.reason},
            )
            self._notify_submitted(cr, target.item)
            return cr

    def _target(self, spec: ActionSpec, data: ChangeRequestCreate) -> Target:
        if spec.target == "item":
            if data.item_id is None:
                raise RuleViolation("This change needs the item it applies to")
            return Target(item=self.uow.items.require(data.item_id))
        if spec.target == "template":
            if data.template_id is None:
                raise RuleViolation("This change needs the template it applies to")
            return Target(template=self.uow.templates.require(data.template_id))
        return Target()

    # ─────────────────────────── review ───────────────────────────
    def approve(self, cr_id: int, note: str | None) -> ChangeRequest:
        return self._decide(cr_id, approve=True, note=note)

    def reject(self, cr_id: int, note: str | None) -> ChangeRequest:
        return self._decide(cr_id, approve=False, note=note)

    def _decide(self, cr_id: int, *, approve: bool, note: str | None) -> ChangeRequest:
        reviewer = self.services.require(Permission.REVIEW_CHANGES)
        with self.uow.transaction():
            cr = self.uow.change_requests.require(cr_id)
            if cr.status != ChangeStatus.PENDING:
                raise RuleViolation("This change request has already been reviewed")
            if approve:
                spec = ACTIONS[cr.action]
                command = parse_command(spec.command, cr.payload, "proposal")
                spec.apply(self.services, cr, command)
            cr.status = ChangeStatus.APPROVED if approve else ChangeStatus.REJECTED
            cr.reviewed_by = reviewer.id
            cr.review_note = (note or "").strip() or None
            cr.reviewed_at = datetime.now(UTC)
            verb = "approved" if approve else "rejected"
            self.audit.record(
                f"change_request.{'approve' if approve else 'reject'}",
                f"{reviewer.full_name} {verb} change request #{cr.id}: {cr.description}",
                item=self.uow.items.get(cr.item_id),
                template=self.uow.templates.get(cr.template_id),
                details={"change_request_id": cr.id, "note": cr.review_note},
            )
            self._notify_decided(cr)
            return cr

    # ─────────────────────────── notifications ───────────────────────────
    def _notify_submitted(self, cr: ChangeRequest, item: Item | None) -> None:
        managers = [m for m in item.managers if m.is_active] if item is not None else []
        managers = managers or self.uow.users.active_managers()
        self.uow.emit(Event(
            type=EventType.CHANGE_REQUEST_SUBMITTED,
            title="A change is waiting for your approval",
            body=f"{cr.description}\n\nWhy: {cr.reason}",
            link=f"/change-requests/{cr.id}",
            recipients=[Recipient(user_id=m.id, email=m.email) for m in managers],
            payload={"change_request_id": cr.id, "action": cr.action.value,
                     "item_id": cr.item_id, "template_id": cr.template_id},
        ))

    def _notify_decided(self, cr: ChangeRequest) -> None:
        approved = cr.status == ChangeStatus.APPROVED
        proposer = cr.proposer
        self.uow.emit(Event(
            type=(EventType.CHANGE_REQUEST_APPROVED if approved
                  else EventType.CHANGE_REQUEST_REJECTED),
            title=f"Your change request was {'approved' if approved else 'rejected'}",
            body=(f"#{cr.id} — {cr.description} — was "
                  f"{'approved and applied' if approved else 'rejected'}."
                  + (f"\nNote: {cr.review_note}" if cr.review_note else "")),
            link=f"/change-requests/{cr.id}",
            recipients=[Recipient(user_id=proposer.id, email=proposer.email)],
            payload={"change_request_id": cr.id, "status": cr.status.value},
        ))
