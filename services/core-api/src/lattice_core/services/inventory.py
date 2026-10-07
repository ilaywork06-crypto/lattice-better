"""Card stock, stock thresholds and low-stock alerts.

All figures are **units** (sums of ``Item.quantity``): a commercial card row
holding 25 counts 25, a serialised card counts 1.

* **desiccator** — cards at a desiccator location. The desiccator is a *place*:
  a card assembled into something that sits there is in it too.
* **available** — desiccator stock in state *built* or *ok*: what can be built
  with right now, and what thresholds watch.
* **in use** — loose elsewhere; **assembled** — inside an item elsewhere.
* Destroyed cards are history, not inventory: they count nowhere.

Alerts are precise: a transaction records which card templates it may have
affected (``stock_changed``) and, once it commits, only those are checked. One
digest goes to each recipient, listing every low template they look after.
"""

from __future__ import annotations

from lattice_core.db.models import Item, StockThreshold
from lattice_core.domain.enums import AVAILABLE_STATES, CardType, ItemState, ItemType
from lattice_core.domain.enums import StorageStatus as Storage
from lattice_core.domain.errors import NotFound, RuleViolation
from lattice_core.domain.permissions import Permission
from lattice_core.schemas.inventory import StockRow, Summary, ThresholdIn, ThresholdOut
from lattice_core.services.base import Service
from lattice_shared.events import Event, EventType, Recipient

_HOOK_FLAG = "_low_stock_hook_registered"


class InventoryService(Service):
    # ─────────────────────────── stock ───────────────────────────
    def stock(self, card_type: CardType | None = None) -> list[StockRow]:
        """One row per card template — even those with no units yet."""
        templates = self.uow.stock.card_templates(card_type)
        thresholds = {t.template_id: t for t in self.uow.thresholds.list()}
        rows = {
            t.id: StockRow(template_id=t.id, name=t.name, card_type=t.card_type,
                           tracking=t.tracking, serial_prefix=t.serial_prefix)
            for t in templates
        }
        for card in self.uow.stock.live_cards(card_type):
            row = rows.get(card.template_id)
            if row is None:
                continue
            units = card.quantity or 1
            row.records += 1
            row.total += units
            match card.storage_status:
                case Storage.ASSEMBLED:
                    row.assembled += units
                case Storage.DESICCATOR:
                    row.desiccator += units
                    if card.parent_id is not None:
                        row.assembled_in_desiccator += units
                    if card.state in AVAILABLE_STATES:
                        row.available += units
                        row.available_serials.append(card.serial)
                case _:
                    row.in_use += units
            if card.state == ItemState.FAULTY:
                row.faulty += units
        for row in rows.values():
            row.available_serials.sort()
            threshold = thresholds.get(row.template_id)
            if threshold is not None:
                row.min_quantity = threshold.min_quantity
                row.is_low = row.available <= threshold.min_quantity
        return list(rows.values())

    def summary(self) -> Summary:
        rows = self.stock()
        units = self.uow.stock.units
        return Summary(
            setups=units(Item.type == ItemType.SETUP),
            assemblies=units(Item.type == ItemType.ASSEMBLY),
            cards=sum(r.total for r in rows),
            cards_in_use=sum(r.in_use for r in rows),
            cards_in_desiccator=sum(r.desiccator for r in rows),
            cards_available=sum(r.available for r in rows),
            faulty_items=units(Item.state == ItemState.FAULTY),
            pending_change_requests=self.uow.change_requests.pending_count(),
            low_stock=sum(1 for r in rows if r.is_low),
            templates=len(self.uow.templates.all_templates()),
        )

    # ─────────────────────────── thresholds ───────────────────────────
    def thresholds(self, template_ids: set[int] | None = None) -> list[ThresholdOut]:
        rows = self.uow.thresholds.list(template_ids)
        available = self.uow.stock.available({t.template_id for t in rows})
        out = [_threshold_out(t, available.get(t.template_id, 0)) for t in rows]
        return sorted(out, key=lambda t: t.name.lower())

    def set_threshold(self, template_id: int, cmd: ThresholdIn) -> ThresholdOut:
        self.services.require(Permission.WRITE_THRESHOLDS)
        with self.uow.transaction():
            tpl = self.uow.templates.require(template_id)
            if tpl.type != ItemType.CARD:
                raise RuleViolation("Stock thresholds are set on card templates")
            threshold = self.uow.thresholds.for_template(tpl.id)
            if threshold is None:
                threshold = self.uow.thresholds.add(StockThreshold(template_id=tpl.id))
            threshold.min_quantity = cmd.min_quantity
            threshold.notify_email = str(cmd.notify_email) if cmd.notify_email else None
            self.audit.record(
                "threshold.set",
                f"Minimum available stock of '{tpl.name}' set to {cmd.min_quantity}",
                template=tpl,
                details={"min_quantity": cmd.min_quantity},
            )
            self.track_templates({tpl.id})
        return self.thresholds({tpl.id})[0]

    def delete_threshold(self, template_id: int) -> None:
        self.services.require(Permission.DELETE_THRESHOLDS)
        with self.uow.transaction():
            threshold = self.uow.thresholds.for_template(template_id)
            if threshold is None:
                raise NotFound("Stock threshold for template", template_id)
            self.audit.record(
                "threshold.delete",
                f"Removed the stock threshold of '{threshold.template.name}'",
                template=threshold.template,
            )
            self.uow.thresholds.delete(threshold)

    # ─────────────────────────── alerts ───────────────────────────
    def stock_changed(self, items: list[Item]) -> None:
        """Note that these items' moves/states/quantities may change card stock."""
        self.track_templates({i.template_id for i in items if i.type == ItemType.CARD})

    def track_templates(self, template_ids: set[int]) -> None:
        if not template_ids:
            return
        self.uow.stock_touched |= template_ids
        if not getattr(self.uow, _HOOK_FLAG, False):
            setattr(self.uow, _HOOK_FLAG, True)
            self.uow.after_commit(self._alert_after_commit)

    def _alert_after_commit(self) -> None:
        touched, self.uow.stock_touched = set(self.uow.stock_touched), set()
        setattr(self.uow, _HOOK_FLAG, False)
        self.alert_low_stock(touched)

    def alert_low_stock(self, template_ids: set[int] | None = None) -> list[ThresholdOut]:
        lows = [t for t in self.thresholds(template_ids) if t.is_low]
        digests: dict[tuple, tuple[Recipient, list[dict]]] = {}

        def add(recipient: Recipient, component: dict) -> None:
            key = (recipient.user_id, recipient.email)
            digests.setdefault(key, (recipient, []))[1].append(component)

        all_managers = self.uow.users.active_managers()
        for low in lows:
            linked = self.uow.items.manager_ids_of_template(low.template_id)
            recipients = [m for m in all_managers if m.id in linked] or all_managers
            component = _component(low)
            for m in recipients:
                add(Recipient(user_id=m.id, email=m.email), component)
            if low.notify_email:
                add(Recipient(email=low.notify_email), component)

        for recipient, components in digests.values():
            single = len(components) == 1
            self.uow.emit(Event(
                type=EventType.LOW_STOCK,
                title=(f"Low stock: {components[0]['name']}" if single
                       else f"Low stock: {len(components)} components below minimum"),
                body=_alert_body(components),
                link=components[0]["link"] if single else "/inventory",
                recipients=[recipient],
                payload={"components": components},
            ))
        return lows


def _threshold_out(t: StockThreshold, available: int) -> ThresholdOut:
    return ThresholdOut(
        id=t.id,
        template_id=t.template_id,
        name=t.template.name,
        card_type=t.template.card_type,
        tracking=t.template.tracking,
        min_quantity=t.min_quantity,
        notify_email=t.notify_email,
        available=available,
        is_low=available <= t.min_quantity,
    )


def _component(low: ThresholdOut) -> dict:
    return {
        "template_id": low.template_id,
        "link": f"/templates/{low.template_id}",
        "name": low.name,
        "card_type": low.card_type.value if low.card_type else None,
        "available": low.available,
        "min_quantity": low.min_quantity,
        "shortfall": max(low.min_quantity - low.available + 1, 1),
    }


def _alert_body(components: list[dict]) -> str:
    lines = [
        "These components are at or below their minimum available stock",
        "(built or OK cards in the desiccator):",
        "",
    ]
    lines += [
        f"• {c['name']} ({c['card_type']}) — {c['available']} available, minimum "
        f"{c['min_quantity']}"
        for c in components
    ]
    lines += ["", "Open Inventory in Lattice to review and restock."]
    return "\n".join(lines)
