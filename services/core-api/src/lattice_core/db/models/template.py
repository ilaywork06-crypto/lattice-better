from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from lattice_core.db.base import Base, Timestamps, enum_column
from lattice_core.domain.enums import (
    CardTracking,
    CardType,
    FieldMode,
    FieldType,
    ItemType,
    card_tracking,
)

if TYPE_CHECKING:
    from lattice_core.db.models.item import Item


class ItemTemplate(Timestamps, Base):
    """The blueprint every item is made from: one per named card, assembly or setup."""

    __tablename__ = "item_templates"
    __table_args__ = (
        UniqueConstraint("type", "name", name="uq_item_templates_type_name"),
        UniqueConstraint("type", "serial_prefix", name="uq_item_templates_type_prefix"),
        CheckConstraint(
            "(type = 'card' AND card_type IS NOT NULL) OR (type <> 'card' AND card_type IS NULL)",
            name="card_type_only_on_cards",
        ),
        CheckConstraint("length(serial_prefix) = 3", name="serial_prefix_len"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[ItemType] = mapped_column(enum_column(ItemType, "item_type"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    card_type: Mapped[CardType | None] = mapped_column(
        enum_column(CardType, "card_type"), nullable=True, index=True
    )
    serial_prefix: Mapped[str] = mapped_column(String(3))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    fields: Mapped[list[TemplateField]] = relationship(
        back_populates="template", cascade="all, delete-orphan", order_by="TemplateField.position"
    )
    child_links: Mapped[list[TemplateChild]] = relationship(
        foreign_keys="TemplateChild.parent_template_id",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="TemplateChild.position",
    )
    parent_links: Mapped[list[TemplateChild]] = relationship(
        foreign_keys="TemplateChild.child_template_id",
        back_populates="child",
        viewonly=True,
    )
    items: Mapped[list[Item]] = relationship(back_populates="template", viewonly=True)

    @property
    def tracking(self) -> CardTracking | None:
        return card_tracking(self.card_type)

    @property
    def child_templates(self) -> list[ItemTemplate]:
        return [link.child for link in self.child_links]

    @property
    def parent_templates(self) -> list[ItemTemplate]:
        return [link.parent for link in self.parent_links]

    def field_by_key(self, key: str) -> TemplateField | None:
        return next((f for f in self.fields if f.key == key), None)

    def child_link(self, child_template_id: int) -> TemplateChild | None:
        return next(
            (link for link in self.child_links if link.child_template_id == child_template_id),
            None,
        )


class FieldColumns:
    """The columns a field definition has, on a template or in a field group."""

    id: Mapped[int] = mapped_column(primary_key=True)
    # Stable machine name, unique within its owner (used by the API and imports).
    key: Mapped[str] = mapped_column(String(64))
    label: Mapped[str] = mapped_column(String(255))
    position: Mapped[int] = mapped_column(Integer, default=0)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    # Per-type settings: ``options`` (a list field's values / an enum's values),
    # ``pattern`` ("XX-#####"), ``min_length`` (description).
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    # The shared value of a ``fixed`` field (ids for reference types).
    fixed_value: Mapped[Any] = mapped_column(JSON, nullable=True)

    @declared_attr
    def field_type(cls) -> Mapped[FieldType]:  # noqa: N805
        return mapped_column(enum_column(FieldType, "field_type"))

    @declared_attr
    def mode(cls) -> Mapped[FieldMode]:  # noqa: N805
        return mapped_column(enum_column(FieldMode, "field_mode"))

    @property
    def options(self) -> list:
        return list((self.config or {}).get("options") or [])


class TemplateField(FieldColumns, Base):
    __tablename__ = "template_fields"
    __table_args__ = (UniqueConstraint("template_id", "key", name="uq_template_fields_key"),)

    template_id: Mapped[int] = mapped_column(
        ForeignKey("item_templates.id", ondelete="CASCADE"), index=True
    )
    template: Mapped[ItemTemplate] = relationship(back_populates="fields")


class TemplateChild(Base):
    """One line of a container template's contents: which template may sit
    inside it, and how many units of it one item holds."""

    __tablename__ = "template_children"
    __table_args__ = (
        CheckConstraint("parent_template_id <> child_template_id", name="not_self"),
        CheckConstraint("min_count >= 0", name="min_count_non_negative"),
        CheckConstraint(
            "max_count IS NULL OR (max_count >= 1 AND max_count >= min_count)",
            name="max_count_valid",
        ),
    )

    parent_template_id: Mapped[int] = mapped_column(
        ForeignKey("item_templates.id", ondelete="CASCADE"), primary_key=True
    )
    child_template_id: Mapped[int] = mapped_column(
        ForeignKey("item_templates.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    min_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    max_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    parent: Mapped[ItemTemplate] = relationship(
        foreign_keys=[parent_template_id], back_populates="child_links"
    )
    child: Mapped[ItemTemplate] = relationship(
        foreign_keys=[child_template_id], back_populates="parent_links"
    )


class FieldGroup(Timestamps, Base):
    """A named, reusable set of field definitions.

    Loading a group into the template editor *copies* its fields: templates
    never stay linked to a group, so editing a group can't change existing
    templates (or their items) behind anyone's back.
    """

    __tablename__ = "field_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    fields: Mapped[list[FieldGroupField]] = relationship(
        back_populates="group", cascade="all, delete-orphan", order_by="FieldGroupField.position"
    )


class FieldGroupField(FieldColumns, Base):
    __tablename__ = "field_group_fields"
    __table_args__ = (UniqueConstraint("group_id", "key", name="uq_field_group_fields_key"),)

    group_id: Mapped[int] = mapped_column(
        ForeignKey("field_groups.id", ondelete="CASCADE"), index=True
    )
    group: Mapped[FieldGroup] = relationship(back_populates="fields")
