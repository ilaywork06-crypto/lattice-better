from fastapi import APIRouter, Query

from lattice_core.api.deps import Svc
from lattice_core.schemas.misc import SearchResults

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResults)
def search(s: Svc, q: str = Query(min_length=1)):
    return s.search.search(q)
