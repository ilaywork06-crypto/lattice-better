"""The service container: every use case of one request, sharing one unit of work."""

from __future__ import annotations

from functools import cached_property
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ValidationError

from lattice_core.db.models import AuditEntry, Item, ItemTemplate, User
from lattice_core.domain.errors import Issue, PermissionDenied, ValidationFailed
from lattice_core.domain.permissions import Permission, has_permission
from lattice_core.services.uow import UnitOfWork
from lattice_core.settings import Settings

if TYPE_CHECKING:
    from lattice_core.services.audit_log import AuditLogService
    from lattice_core.services.auth import AuthService
    from lattice_core.services.catalog import CatalogService
    from lattice_core.services.documents import DocumentService
    from lattice_core.services.field_groups import FieldGroupService
    from lattice_core.services.field_values import FieldValues
    from lattice_core.services.graph import GraphService
    from lattice_core.services.hierarchy import HierarchyService
    from lattice_core.services.inventory import InventoryService
    from lattice_core.services.items import ItemService
    from lattice_core.services.locations import LocationService
    from lattice_core.services.search import SearchService
    from lattice_core.services.spreadsheets import SpreadsheetService
    from lattice_core.services.templates import TemplateService
    from lattice_core.services.users import UserService
    from lattice_core.services.workflow import WorkflowService


class Services:
    """Lazily builds each service for one actor and one unit of work."""

    def __init__(self, uow: UnitOfWork, settings: Settings, actor: User | None = None) -> None:
        self.uow = uow
        self.settings = settings
        self.actor = actor

    def require(self, permission: Permission) -> User:
        if self.actor is None or not has_permission(self.actor.role, permission):
            raise PermissionDenied("You don't have permission to do that")
        return self.actor

    @cached_property
    def audit(self) -> AuditTrail:
        return AuditTrail(self.uow, self.actor)

    @cached_property
    def values(self) -> FieldValues:
        from lattice_core.services.field_values import FieldValues
        return FieldValues(self.uow)

    @cached_property
    def audit_log(self) -> AuditLogService:
        from lattice_core.services.audit_log import AuditLogService
        return AuditLogService(self)

    @cached_property
    def auth(self) -> AuthService:
        from lattice_core.services.auth import AuthService
        return AuthService(self)

    @cached_property
    def users(self) -> UserService:
        from lattice_core.services.users import UserService
        return UserService(self)

    @cached_property
    def catalog(self) -> CatalogService:
        from lattice_core.services.catalog import CatalogService
        return CatalogService(self)

    @cached_property
    def locations(self) -> LocationService:
        from lattice_core.services.locations import LocationService
        return LocationService(self)

    @cached_property
    def templates(self) -> TemplateService:
        from lattice_core.services.templates import TemplateService
        return TemplateService(self)

    @cached_property
    def field_groups(self) -> FieldGroupService:
        from lattice_core.services.field_groups import FieldGroupService
        return FieldGroupService(self)

    @cached_property
    def items(self) -> ItemService:
        from lattice_core.services.items import ItemService
        return ItemService(self)

    @cached_property
    def hierarchy(self) -> HierarchyService:
        from lattice_core.services.hierarchy import HierarchyService
        return HierarchyService(self)

    @cached_property
    def documents(self) -> DocumentService:
        from lattice_core.services.documents import DocumentService
        return DocumentService(self)

    @cached_property
    def workflow(self) -> WorkflowService:
        from lattice_core.services.workflow import WorkflowService
        return WorkflowService(self)

    @cached_property
    def inventory(self) -> InventoryService:
        from lattice_core.services.inventory import InventoryService
        return InventoryService(self)

    @cached_property
    def graph(self) -> GraphService:
        from lattice_core.services.graph import GraphService
        return GraphService(self)

    @cached_property
    def search(self) -> SearchService:
        from lattice_core.services.search import SearchService
        return SearchService(self)

    @cached_property
    def spreadsheets(self) -> SpreadsheetService:
        from lattice_core.services.spreadsheets import SpreadsheetService
        return SpreadsheetService(self)


class Service:
    def __init__(self, services: Services) -> None:
        self.services = services
        self.uow = services.uow
        self.settings = services.settings

    @property
    def actor(self) -> User:
        assert self.services.actor is not None, "this use case needs a signed-in user"
        return self.services.actor

    @property
    def audit(self) -> AuditTrail:
        return self.services.audit


class AuditTrail:
    """Writes the immutable change log."""

    def __init__(self, uow: UnitOfWork, actor: User | None) -> None:
        self.uow = uow
        self.actor = actor

    def record(
        self,
        action: str,
        summary: str,
        *,
        item: Item | None = None,
        template: ItemTemplate | None = None,
        details: dict | None = None,
    ) -> AuditEntry:
        if template is None and item is not None:
            template = item.template
        subject = item.label if item is not None else template.name if template else None
        entry = AuditEntry(
            item_id=item.id if item is not None else None,
            template_id=template.id if template is not None else None,
            subject=subject,
            action=action,
            summary=summary,
            details=details or {},
            user_id=self.actor.id if self.actor else None,
            user_name=self.actor.full_name if self.actor else None,
        )
        self.uow.session.add(entry)
        return entry


def parse_command[T: BaseModel](model: type[T], data: Any, what: str) -> T:
    """Validate free-form JSON (a proposal's payload) into a typed command."""
    try:
        return model.model_validate(data or {})
    except ValidationError as exc:
        issues = [
            Issue(
                message=e["msg"],
                field=".".join(str(p) for p in e["loc"]) or None,
            )
            for e in exc.errors()
        ]
        raise ValidationFailed(f"The details of this {what} are not valid", issues) from None
