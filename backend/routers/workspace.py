"""Page rasters and annotated-PDF export for the iPad workspace."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from models import (
    WorkspaceDocumentInfo,
    WorkspaceExportRequest,
    WorkspaceExportResponse,
    WorkspaceKind,
)
from services.pdf_pages import (
    WorkspaceDocumentError,
    flatten_annotations,
    pdf_page_count,
    render_page_png,
    resolve_document,
)

router = APIRouter()
_exports: dict[str, str] = {}


def _lookup(kind: WorkspaceKind, document_id: str):
    try:
        path = resolve_document(kind, document_id)
        return path, pdf_page_count(path)
    except WorkspaceDocumentError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/workspace/document", response_model=WorkspaceDocumentInfo)
def workspace_document(kind: WorkspaceKind, id: str) -> WorkspaceDocumentInfo:
    _path, page_count = _lookup(kind, id)
    return WorkspaceDocumentInfo(kind=kind, id=id, page_count=page_count)


@router.get("/workspace/pages/{page_number}")
def workspace_page(page_number: int, kind: WorkspaceKind, id: str) -> FileResponse:
    try:
        path = render_page_png(kind, id, page_number)
    except WorkspaceDocumentError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(
        path,
        media_type="image/png",
        filename=f"{kind}-{id}-p{page_number}.png",
        content_disposition_type="inline",
    )


@router.post("/workspace/export", response_model=WorkspaceExportResponse)
def workspace_export(body: WorkspaceExportRequest) -> WorkspaceExportResponse:
    try:
        pdf_path = flatten_annotations(body)
        page_count = pdf_page_count(pdf_path)
    except WorkspaceDocumentError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not flatten that PDF: {exc}") from exc

    _exports[pdf_path.stem] = str(pdf_path)
    return WorkspaceExportResponse(
        export_id=pdf_path.stem,
        pdf_url=f"/workspace/exports/{pdf_path.stem}/file",
        page_count=page_count,
    )


@router.get("/workspace/exports/{export_id}/file")
def workspace_export_file(export_id: str) -> FileResponse:
    stored = _exports.get(export_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Exported PDF not found.")
    path = Path(stored)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Exported PDF not found.")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"{export_id}.pdf",
        content_disposition_type="inline",
    )
