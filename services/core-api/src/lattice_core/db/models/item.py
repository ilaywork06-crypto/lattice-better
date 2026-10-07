from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lattice_core.db.base import Base, Timestamps, enum_column, utcnow
from lattice_core.db.models.catalog import CatalogOption
from lattice_core.db.models.location import Location
from lattice_core.db.models.template import ItemTemplate, TemplateField
from lattice_core.db.models.user import User
from lattice_core.domain.enums import CardType, ItemState, ItemType, StorageStatus

if TYPE_CHECKING:
    from lattice_core.db.models.document import Document

#: Which managers own an item (approval routing, "my items" in the audit log).
item_managers = Table(
    "item_managers",
    Base.metadata,
    Column("item_id", ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Item(Timestamps, Base):
    """One physical unit (or, for a commercial card, a quantity of units).

    Values other tables depend on — catalog values, people, location, parent,
    state, quantity — are real foreign-key columns; free-form values live in
    ``item_field_values``. A template's *fixed* free-form values are not copied
    here at all: they are read through the template.
    """

    __tablename__ = "items"
    __table_args__ = (CheckConstraint("quantity >= 1", name="quantity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # RESTRICT: a template with items can't vanish from under them.
    template_id: Mapped[int] = mapped_column(
        ForeignKey("item_templates.id", ondelete="RESTRICT"), index=True
    )
    # Mirrors template.type (immutable); kept on the row because every list and
    # hierarchy rule filters on it.
    type: Mapped[ItemType] = mapped_column(enum_column(ItemType, "item_type"), index=True)
    serial: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    state: Mapped[ItemState] = mapped_column(
        enum_column(ItemState, "item_state"), default=ItemState.BUILT, index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    industry_id: Mapped[int | None] = mapped_column(
        ForeignKey("catalog_options.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("catalog_options.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    team_id: Mapped[int | None] = mapped_column(
        ForeignKey("catalog_options.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    responsible_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    template: Mapped[ItemTemplate] = relationship(back_populates="items")
    parent: Mapped[Item | None] = relationship(remote_side="Item.id", back_populates="children")
    children: Mapped[list[Item]] = relationship(back_populates="parent", order_by="Item.serial")
    location: Mapped[Location | None] = relationship()
    industry: Mapped[CatalogOption | None] = relationship(foreign_keys=[industry_id])
    project: Mapped[CatalogOption | None] = relationship(foreign_keys=[project_id])
    team: Mapped[CatalogOption | None] = relationship(foreign_keys=[team_id])
    responsible: Mapped[User | None] = relationship(foreign_keys=[responsible_id])
    managers: Mapped[list[User]] = relationship(secondary=item_managers, order_by="User.full_name")
    field_values: Mapped[list[ItemFieldValue]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )
    state_history: Mapped[list[StateHistory]] = relationship(
        back_populates="item", cascade="all, delete-orphan", order_by="StateHistory.changed_at"
    )
    documents: Mapped[list[Document]] = relationship(
        back_populates="item", cascade="all, delete-orphan", order_by="Document.created_at"
    )
    extras: Mapped[list[ExtraItem]] = relationship(
        back_populates="setup", cascade="all, delete-orphan", order_by="ExtraItem.id"
    )

    # ── derived facts ──
    @property
    def name(self) -> str:
        """An item is named by its template; the serial tells units apart."""
        return self.template.name

    @property
    def card_type(self) -> CardType | None:
        return self.template.card_type

    @property
    def label(self) -> str:
        return f"{self.name} ({self.serial})"

    @property
    def storage_status(self) -> StorageStatus | None:
        """Where a card is: the desiccator is a *place*, so being at a desiccator
        location wins over being assembled."""
        if self.type != ItemType.CARD:
            return None
        if self.location is not None and self.location.is_desiccator:
            return StorageStatus.DESICCATOR
        if self.parent_id is not None:
            return StorageStatus.ASSEMBLED
        return StorageStatus.IN_USE

    def descendants(self) -> list[Item]:
        out: list[Item] = []
        seen: set[int] = set()
        stack = list(self.children)
        while stack:
            node = stack.pop()
            if node.id in seen:
                continue
            seen.add(node.id)
            out.append(node)
            stack.extend(node.children)
        return out

    def ancestors(self) -> list[Item]:
        out: list[Item] = []
        cur = self.parent
        while cur is not None and cur not in out:
            out.append(cur)
            cur = cur.parent
        return out

    def own_value(self, field_id: int) -> ItemFieldValue | None:
        return next((v for v in self.field_values if v.field_id == field_id), None)


class ItemFieldValue(Base):
    """The value of a free-form template field on one item."""

    __tablename__ = "item_field_values"
    __table_args__ = (
        UniqueConstraint("item_id", "field_id", name="uq_item_field_values_item_field"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    field_id: Mapped[int] = mapped_column(
        ForeignKey("template_fields.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[Any] = mapped_column(JSON, nullable=True)

    item: Mapped[Item] = relationship(back_populates="field_values")
    field: Mapped[TemplateField] = relationship()


class StateHistory(Base):
    """Append-only log of state transitions."""

    __tablename__ = "state_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    state: Mapped[ItemState] = mapped_column(enum_column(ItemState, "item_state"))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    item: Mapped[Item] = relationship(back_populates="state_history")
    user: Mapped[User | None] = relationship()


class ExtraItem(Base):
    """A non-card accessory inside a setup (power supply, burner, …)."""

    __tablename__ = "extra_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    setup_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    company_part_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    serial: Mapped[str | None] = mapped_column(String(128), nullable=True)
    signed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    setup: Mapped[Item] = relationship(back_populates="extras")
