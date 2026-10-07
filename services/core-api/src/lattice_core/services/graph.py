"""Hierarchy graphs.

Drawing every item at once stops being readable long before the system stops
growing, so there are three focused views:

* the hierarchy the **templates** define (small, stable, always readable);
* every live tree built from one template (one tree per item);
* one item's tree, optionally with the path up to the top.
"""

from __future__ import annotations

from lattice_core.db.models import Item, ItemTemplate
from lattice_core.domain.permissions import Permission
from lattice_core.schemas.misc import GraphEdge, GraphNode, GraphOut
from lattice_core.services.base import Service


def _subtree(root: Item) -> list[Item]:
    return [root, *root.descendants()]


def _item_graph(items: list[Item], roots: list[int], focus: int | None = None) -> GraphOut:
    ids = {i.id for i in items}
    return GraphOut(
        nodes=[
            GraphNode(id=i.id, label=i.name, type=i.type, state=i.state, card_type=i.card_type,
                      serial=i.serial, template_id=i.template_id)
            for i in items
        ],
        edges=[GraphEdge(source=i.parent_id, target=i.id) for i in items if i.parent_id in ids],
        roots=roots,
        focus=focus,
    )


class GraphService(Service):
    def templates(self, root_template_id: int | None = None) -> GraphOut:
        self.services.require(Permission.READ)
        templates: list[ItemTemplate] = self.uow.templates.all_templates()
        if root_template_id is not None:
            root = self.uow.templates.require(root_template_id)
            chosen: dict[int, ItemTemplate] = {}
            stack = [root]
            while stack:
                cur = stack.pop()
                if cur.id not in chosen:
                    chosen[cur.id] = cur
                    stack.extend(cur.child_templates)
            templates = list(chosen.values())
        counts = self.uow.templates.state_counts([t.id for t in templates])
        ids = {t.id for t in templates}
        return GraphOut(
            nodes=[
                GraphNode(id=t.id, label=t.name, type=t.type, card_type=t.card_type,
                          serial=t.serial_prefix, template_id=t.id,
                          count=counts[t.id].total if t.id in counts else 0)
                for t in templates
            ],
            edges=[
                GraphEdge(source=t.id, target=link.child_template_id,
                          min_count=link.min_count, max_count=link.max_count)
                for t in templates
                for link in t.child_links
                if link.child_template_id in ids
            ],
            roots=[t.id for t in templates if not any(p.id in ids for p in t.parent_templates)],
            focus=root_template_id,
        )

    def trees_of_template(self, template_id: int) -> GraphOut:
        self.services.require(Permission.READ)
        self.uow.templates.require(template_id)
        roots = self.uow.items.of_template(template_id)
        seen: dict[int, Item] = {}
        for r in roots:
            for i in _subtree(r):
                seen.setdefault(i.id, i)
        return _item_graph(list(seen.values()), [r.id for r in roots])

    def item_tree(self, item_id: int, with_ancestors: bool = True) -> GraphOut:
        self.services.require(Permission.READ)
        root = self.uow.items.require(item_id)
        items = _subtree(root)
        top = root
        if with_ancestors:
            for a in root.ancestors():
                items.append(a)
                top = a
        return _item_graph(items, [top.id], focus=root.id)

    def everything(self) -> GraphOut:
        self.services.require(Permission.READ)
        items = self.uow.items.everything()
        return _item_graph(items, [i.id for i in items if i.parent_id is None])
