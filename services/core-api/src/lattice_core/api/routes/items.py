from fastapi import APIRouter, File, Form, Query, UploadFile, status

from lattice_core.api.deps import Svc
from lattice_core.api.uploads import incoming
from lattice_core.domain.enums import CardType, ItemState, ItemType, StorageStatus
from lattice_core.repositories.items import ItemFilter
from lattice_core.schemas.common import Page
from lattice_core.schemas.documents import DocumentOut
from lattice_core.schemas.items import (
    BulkCommand,
    BulkResult,
    ContentsCommand,
    ExtraIn,
    ExtraOut,
    ItemCreate,
    ItemDetail,
    ItemRow,
    ItemUpdate,
    LinkCommand,
    LinkDocumentCommand,
    MoveCommand,
    StateCommand,
    UnlinkCommand,
)
from lattice_core.schemas.misc import GraphOut
from lattice_core.views.items import item_detail, item_row

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=Page[ItemRow])
def list_items(
    s: Svc,
    type: ItemType | None = None,
    template_id: int | None = None,
    state: ItemState | None = None,
    card_type: CardType | None = None,
    storage: StorageStatus | None = None,
    location_id: int | None = None,
    parent_id: int | None = None,
    top_level: bool | None = Query(None, description="Only items not inside anything"),
    include_destroyed: bool = True,
    fits_in_template: int | None = Query(
        None, description="Items whose template may be placed inside this template"),
    holds_template: int | None = Query(
        None, description="Items whose template may hold this template"),
    q: str | None = Query(None, description="Search template name and serial"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    f = ItemFilter(type=type, template_id=template_id, state=state, card_type=card_type,
                   storage=storage, location_id=location_id, parent_id=parent_id,
                   top_level=top_level, include_destroyed=include_destroyed,
                   fits_in_template=fits_in_template, holds_template=holds_template, search=q)
    rows, total = s.items.page(f, limit=limit, offset=offset)
    return Page(items=[item_row(i) for i in rows], total=total, limit=limit, offset=offset)


@router.get("/{item_id}", response_model=ItemDetail)
def get_item(item_id: int, s: Svc):
    return item_detail(s, s.items.get(item_id))


@router.get("/{item_id}/tree", response_model=GraphOut,
            summary="The item's tree, with the path up to the top")
def item_tree(item_id: int, s: Svc, ancestors: bool = True):
    return s.graph.item_tree(item_id, ancestors)


@router.post("", response_model=ItemDetail, status_code=status.HTTP_201_CREATED)
def create_item(body: ItemCreate, s: Svc):
    return item_detail(s, s.items.create(body))


@router.patch("/{item_id}", response_model=ItemDetail)
def update_item(item_id: int, body: ItemUpdate, s: Svc):
    return item_detail(s, s.items.update(item_id, body))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Delete an item (its contents are taken out, not deleted)")
def delete_item(item_id: int, s: Svc) -> None:
    s.items.delete(item_id)


@router.post("/bulk", response_model=BulkResult, summary="One action on many items, atomically")
def bulk(body: BulkCommand, s: Svc):
    return BulkResult(processed=s.items.bulk(body))


@router.post("/{item_id}/move", response_model=ItemDetail,
             summary="Move an item; everything inside it follows")
def move(item_id: int, body: MoveCommand, s: Svc):
    return item_detail(s, s.hierarchy.move(item_id, body))


@router.post("/{item_id}/link", response_model=ItemDetail, summary="Place an item inside another")
def link(item_id: int, body: LinkCommand, s: Svc):
    return item_detail(s, s.hierarchy.link(item_id, body))


@router.post("/{item_id}/unlink", response_model=ItemDetail,
             summary="Take an item out of its container")
def unlink(item_id: int, s: Svc, body: UnlinkCommand | None = None):
    return item_detail(s, s.hierarchy.unlink(item_id, body or UnlinkCommand()))


@router.put("/{item_id}/children", response_model=ItemDetail,
            summary="Set a container's contents (the end state)")
def set_children(item_id: int, body: ContentsCommand, s: Svc):
    return item_detail(s, s.hierarchy.set_contents(item_id, body))


@router.post("/{item_id}/state", response_model=ItemDetail,
             summary="Change state (a note is required into or out of 'faulty')")
def change_state(item_id: int, body: StateCommand, s: Svc):
    return item_detail(s, s.items.change_state(item_id, body))


@router.post("/{item_id}/documents", response_model=DocumentOut,
             status_code=status.HTTP_201_CREATED, summary="Upload a file to an item")
def upload_document(item_id: int, s: Svc, file: UploadFile = File(...),
                    name: str | None = Form(None), doc_type: str | None = Form(None)):
    return s.documents.upload_to_item(item_id, incoming(file), name=name, doc_type=doc_type)


@router.post("/{item_id}/links", response_model=DocumentOut, status_code=status.HTTP_201_CREATED,
             summary="Attach a link to an item")
def link_document(item_id: int, body: LinkDocumentCommand, s: Svc):
    return s.documents.link_to_item(item_id, body)


@router.delete("/{item_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(item_id: int, doc_id: int, s: Svc) -> None:
    s.documents.remove_from_item(item_id, doc_id)


@router.post("/{item_id}/extras", response_model=ExtraOut, status_code=status.HTTP_201_CREATED)
def add_extra(item_id: int, body: ExtraIn, s: Svc):
    return s.items.add_extra(item_id, body)


@router.delete("/{item_id}/extras/{extra_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_extra(item_id: int, extra_id: int, s: Svc) -> None:
    s.items.remove_extra(item_id, extra_id)
