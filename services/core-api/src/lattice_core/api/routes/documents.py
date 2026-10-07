from fastapi import APIRouter, File, Form, UploadFile, status
from fastapi.responses import FileResponse

from lattice_core.api.deps import Svc
from lattice_core.api.uploads import incoming
from lattice_core.schemas.documents import DocumentOut

router = APIRouter(tags=["documents"])


@router.post("/uploads", response_model=DocumentOut, status_code=status.HTTP_201_CREATED,
             summary="Stage a file before the item it belongs to exists")
def stage_upload(s: Svc, file: UploadFile = File(...), name: str | None = Form(None)):
    return s.documents.stage(incoming(file), name)


@router.get("/documents/{doc_id}/download", response_class=FileResponse)
def download(doc_id: int, s: Svc):
    d = s.documents.download(doc_id)
    return FileResponse(d.path, media_type=d.content_type, filename=d.filename)
