"""Generate and serve fill-in lecture templates."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from models import GenerateRequest, GenerateResponse
from services import storage
from services.generator import generate_stub_pdf

router = APIRouter()


@router.post("/templates/generate", response_model=GenerateResponse)
def generate_template(body: GenerateRequest) -> GenerateResponse:
    source = storage.get_source(body.source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Upload lecture slides first.")

    pdf_path = storage.new_template_path()
    generate_stub_pdf(
        source,
        pdf_path,
        density=body.density,
        text_size=body.text_size,
        include_diagrams=body.include_diagrams,
        include_code=body.include_code,
    )
    record = storage.save_template(
        source.id,
        pdf_path,
        settings=body.model_dump(),
    )
    return GenerateResponse(
        template_id=record.id,
        pdf_url=f"/templates/{record.id}/file",
        stub=True,
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
