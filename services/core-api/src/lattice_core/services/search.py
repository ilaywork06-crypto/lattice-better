"""One search box for the whole system.

Looks through items (template name, serial, catalog values), templates, locations
and — for those who manage users — users, and ranks every list so the best
match comes first: exact, then prefix, then word start, then substring.
"""

from __future__ import annotations

from lattice_core.domain.permissions import Permission, has_permission
from lattice_core.schemas.misc import SearchHit, SearchResults
from lattice_core.services.base import Service

_LIMITS = {"items": 20, "templates": 8, "locations": 8, "users": 8}


def score(query: str, *fields: str | None) -> int:
    best = 0
    for raw in fields:
        if not raw:
            continue
        f = raw.lower()
        if f == query:
            best = max(best, 100)
        elif f.startswith(query):
            best = max(best, 80)
        elif f" {query}" in f" {f}":
            best = max(best, 65)
        elif query in f:
            best = max(best, 45)
    return best


class SearchService(Service):
    def search(self, q: str) -> SearchResults:
        user = self.services.require(Permission.READ)
        term = q.strip()
        ql = term.lower()
        out = SearchResults(query=term)
        if not term:
            return out

        items = self.uow.items.search(term, 200)

        def item_key(i):
            return (-score(ql, i.serial, i.name, *(c.value for c in (i.project, i.industry, i.team)
                                                     if c is not None)),
                    i.name.lower(), i.serial)

        for i in sorted(items, key=item_key)[:_LIMITS["items"]]:
            out.items.append(SearchHit(
                kind="item", id=i.id, title=f"{i.name} · {i.serial}",
                subtitle=" · ".join(p for p in (i.project.value if i.project else None,
                                                i.location.name if i.location else None) if p)
                or None,
                badge=i.type.value, state=i.state, link=f"/items/{i.id}",
            ))

        templates = self.uow.templates.search(term, 80)
        for t in sorted(templates, key=lambda t: (-score(ql, t.name, t.serial_prefix),
                                                  t.name.lower()))[:_LIMITS["templates"]]:
            out.templates.append(SearchHit(kind="template", id=t.id, title=t.name,
                                           subtitle=t.serial_prefix, badge=t.type.value,
                                           link=f"/templates/{t.id}"))

        locations = self.uow.locations.search(term, 80)
        for loc in sorted(locations, key=lambda x: (-score(ql, x.name, x.building, x.room),
                                                    x.name.lower()))[:_LIMITS["locations"]]:
            out.locations.append(SearchHit(
                kind="location", id=loc.id, title=loc.name,
                subtitle=" · ".join(p for p in (loc.building, loc.room) if p) or None,
                badge="desiccator" if loc.is_desiccator else "location",
                link=f"/locations?selected={loc.id}",
            ))

        if has_permission(user.role, Permission.MANAGE_USERS):
            users = self.uow.users.search(term, 80)
            for u in sorted(users, key=lambda u: (-score(ql, u.full_name, u.email),
                                                  u.full_name.lower()))[:_LIMITS["users"]]:
                out.users.append(SearchHit(kind="user", id=u.id, title=u.full_name,
                                           subtitle=u.email, badge=u.role.value,
                                           link="/admin/users"))
        return out
