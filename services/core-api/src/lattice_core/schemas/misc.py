"""Graph, search and spreadsheet shapes."""

from __future__ import annotations

from pydantic import BaseModel, Field

from lattice_core.domain.enums import CardType, ItemState, ItemType


class GraphNode(BaseModel):
    id: int
    label: str
    type: ItemType
    state: ItemState | None = None
    card_type: CardType | None = None
    serial: str | None = None
    template_id: int | None = None
    count: int | None = None


class GraphEdge(BaseModel):
    source: int
    target: int
    min_count: int | None = None
    max_count: int | None = None


class GraphOut(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    roots: list[int] = Field(default_factory=list)
    focus: int | None = None


class SearchHit(BaseModel):
    kind: str  # item | template | location | user
    id: int
    title: str
    subtitle: str | None = None
    badge: str | None = None
    state: ItemState | None = None
    link: str


class SearchResults(BaseModel):
    query: str
    items: list[SearchHit] = Field(default_factory=list)
    templates: list[SearchHit] = Field(default_factory=list)
    locations: list[SearchHit] = Field(default_factory=list)
    users: list[SearchHit] = Field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.items) + len(self.templates) + len(self.locations) + len(self.users)


class ImportResult(BaseModel):
    created: int
    by_template: dict[str, int] = Field(default_factory=dict)
