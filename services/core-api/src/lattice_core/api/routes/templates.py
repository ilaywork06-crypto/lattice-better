from fastapi import APIRouter, File, Form, UploadFile, status

from lattice_core.api.deps import Svc
from lattice_core.api.uploads import incoming
from lattice_core.domain.enums import CardType, ItemType
from lattice_core.schemas.documents import DocumentOut
from lattice_core.schemas.templates import (
    TemplateCreate,
    TemplateDetail,
    TemplateSummary,
    TemplateUpdate,
)
from lattice_core.views.templates import template_detail, template_summaries

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateSummary],
            summary="Every template, with its units per state")
def list_templates(s: Svc, type: ItemType | None = None, card_type: CardType | None = None,
                   search: str | None = None):
    return template_summaries(s, s.templates.list(type=type, card_type=card_type, search=search))


@router.get("/{template_id}", response_model=TemplateDetail)
def get_template(template_id: int, s: Svc):
    return template_detail(s, s.templates.get(template_id))


@router.post("", response_model=TemplateDetail, status_code=status.HTTP_201_CREATED)
def create_template(body: TemplateCreate, s: Svc):
    return template_detail(s, s.templates.create(body))


@router.patch("/{template_id}", response_model=TemplateDetail,
              summary="Edit a template — changes reach every item made from it")
def update_template(template_id: int, body: TemplateUpdate, s: Svc):
    return template_detail(s, s.templates.update(template_id, body))


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, s: Svc) -> None:
    s.templates.delete(template_id)


@router.post("/{template_id}/fields/{field_id}/files", response_model=DocumentOut,
             status_code=status.HTTP_201_CREATED,
             summary="Upload a file to a fixed files field (shared by every item)")
def upload_template_file(template_id: int, field_id: int, s: Svc,
                         file: UploadFile = File(...), name: str | None = Form(None)):
    return s.documents.upload_to_template(template_id, field_id, incoming(file), name)


@router.delete("/{template_id}/files/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template_file(template_id: int, doc_id: int, s: Svc) -> None:
    s.documents.remove_from_template(template_id, doc_id)
