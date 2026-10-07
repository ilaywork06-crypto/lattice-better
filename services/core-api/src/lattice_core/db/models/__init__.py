"""All ORM models. Importing this package registers every table on ``Base.metadata``."""

from lattice_core.db.models.audit import AuditEntry
from lattice_core.db.models.catalog import CatalogLink, CatalogOption
from lattice_core.db.models.document import Document
from lattice_core.db.models.inventory import StockThreshold
from lattice_core.db.models.item import ExtraItem, Item, ItemFieldValue, StateHistory, item_managers
from lattice_core.db.models.location import Location, MapBuilding
from lattice_core.db.models.template import (
    FieldGroup,
    FieldGroupField,
    ItemTemplate,
    TemplateChild,
    TemplateField,
)
from lattice_core.db.models.user import User
from lattice_core.db.models.workflow import ChangeRequest

__all__ = [
    "AuditEntry",
    "CatalogLink",
    "CatalogOption",
    "ChangeRequest",
    "Document",
    "ExtraItem",
    "FieldGroup",
    "FieldGroupField",
    "Item",
    "ItemFieldValue",
    "ItemTemplate",
    "Location",
    "MapBuilding",
    "StateHistory",
    "StockThreshold",
    "TemplateChild",
    "TemplateField",
    "User",
    "item_managers",
]
