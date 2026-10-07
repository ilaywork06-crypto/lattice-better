from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response

from lattice_core.api.deps import Svc
from lattice_core.domain.enums import ItemType
from lattice_core.schemas.misc import ImportResult
from lattice_core.services.spreadsheets import XLSX

router = APIRouter(prefix="/spreadsheets", tags=["import / export"])


def _xlsx(content: bytes, filename: str) -> Response:
    return Response(content, media_type=XLSX,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/import-template",
            summary="An import workbook: one sheet per template, headers = its creation fields")
def import_template(s: Svc, template_id: int | None = None, type: ItemType | None = None):
    content = s.spreadsheets.import_workbook(template_id, type)
    return _xlsx(content, s.spreadsheets.filename("import", template_id, type))


@router.post("/import", response_model=ImportResult,
             summary="Create items from a workbook — all rows, or (on any bad cell) none")
def import_items(s: Svc, file: UploadFile = File(...)):
    return s.spreadsheets.import_items(file.file.read(), file.filename or "")


@router.get("/export", summary="Every item, one sheet per template")
def export(s: Svc, template_id: int | None = None, type: ItemType | None = None):
    content = s.spreadsheets.export_items(template_id, type)
    return _xlsx(content, s.spreadsheets.filename("export", template_id, type))
