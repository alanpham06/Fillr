"""Generate fill-in lecture templates and merge re-uploaded notes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from config import MAX_UPLOAD_BYTES, TEX_DIR
from models import GenerateRequest, GenerateResponse, NotesUploadResponse
from services import storage
from services.extractor import TextExtractor, get_extractor
from services.generator import generate_template_pdf
from services.notes import NotesFillError, fill_template_from_notes
from services.pdf_pages import pdf_page_count
from services.storage import ALLOWED_UPLOAD_SUFFIXES

router = APIRouter()


@router.post("/templates/generate", response_model=GenerateResponse)
def generate_template(body: GenerateRequest) -> GenerateResponse:
    source = storage.get_source(body.source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Upload lecture slides first.")

    pdf_path = storage.new_template_path()
    result = generate_template_pdf(
        source,
        pdf_path,
        density=body.density,
        text_size=body.text_size,
        include_diagrams=body.include_diagrams,
        include_code=body.include_code,
    )
    tex_path = TEX_DIR / f"{pdf_path.stem}.tex"
    record = storage.save_template(
        source.id,
        pdf_path,
        settings=body.model_dump(),
        tex_path=tex_path if tex_path.is_file() else None,
    )
    return GenerateResponse(
        template_id=record.id,
        pdf_url=f"/templates/{record.id}/file",
        page_count=pdf_page_count(pdf_path),
        stub=not result.used_llm,
    )


@router.post("/templates/{template_id}/notes", response_model=NotesUploadResponse)
async def upload_notes(
    template_id: str,
    file: UploadFile = File(...),
    extractor: TextExtractor = Depends(get_extractor),
) -> NotesUploadResponse:
    template = storage.get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Generate a template first.")
    source = storage.get_source(template.source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Original slides are gone.")

    filename = file.filename or "notes.pdf"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        raise HTTPException(
            status_code=422,
            detail="Please upload a PDF or an image of your filled notes.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 25 MB.")

    notes_path = storage.write_notes_upload(filename, content)
    filled_pdf = storage.new_template_path()
    try:
        pdf_path, tex_path, mapper, pages = fill_template_from_notes(
            template,
            source,
            notes_path,
            filled_pdf,
            extractor,
        )
    except NotesFillError as exc:
        notes_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    filled = storage.save_filled(
        template,
        pdf_path,
        tex_path=tex_path,
        mapper=mapper,
    )
    return NotesUploadResponse(
        template_id=template.id,
        filled_template_id=filled.id,
        pdf_url=f"/templates/{template.id}/filled",
        mapper=mapper,  # type: ignore[arg-type]
        ocr_pages=len(pages),
        page_count=pdf_page_count(pdf_path),
        stub=mapper != "nemotron",
    )


@router.get("/templates/{template_id}/file")
def template_file(template_id: str) -> FileResponse:
    record = storage.get_template(template_id)
    if record is None or not record.path.is_file():
        raise HTTPException(status_code=404, detail="Template PDF not found.")
    filename = f"{record.id}-lecture-template.pdf"
    return FileResponse(
        record.path,
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline",
    )


@router.get("/templates/{template_id}/filled")
def filled_file(template_id: str) -> FileResponse:
    record = storage.get_template(template_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Template not found.")
    path = record.filled_path if record.filled_path and record.filled_path.is_file() else None
    if path is None and record.path.is_file() and (record.settings or {}).get("kind") == "filled":
        path = record.path
    if path is None:
        raise HTTPException(status_code=404, detail="No filled notes for this template yet.")
    filename = f"{record.id}-filled-notes.pdf"
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline",
    )
