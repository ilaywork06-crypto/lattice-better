from fastapi import APIRouter

from lattice_core.api.deps import Svc
from lattice_core.schemas.misc import GraphOut

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/templates", response_model=GraphOut,
            summary="The hierarchy the templates define")
def template_graph(s: Svc, root_template_id: int | None = None):
    return s.graph.templates(root_template_id)


@router.get("/items", response_model=GraphOut,
            summary="Every live tree built from a template (or everything)")
def item_graph(s: Svc, template_id: int | None = None):
    return s.graph.trees_of_template(template_id) if template_id else s.graph.everything()
