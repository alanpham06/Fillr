"""Upload lecture PDFs and extract native text."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from config import MAX_UPLOAD_BYTES
from models import IngestResponse
from services.extractor import ExtractionError, TextExtractor, get_extractor
from services import storage

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    file: UploadFile = File(...),
    extractor: TextExtractor = Depends(get_extractor),
) -> IngestResponse:
    filename = file.filename or "lecture.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Please upload a PDF file.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="PDF is larger than 25 MB.")

    source_id, dest = storage.write_upload(filename, content)
    try:
        pages = extractor.extract(dest)
    except ExtractionError as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    record = storage.put_source(source_id, filename, dest, pages)
    return IngestResponse(
        id=record.id,
        filename=record.filename,
        page_count=record.page_count,
        file_url=f"/sources/{record.id}/file",
    )


@router.get("/sources/{source_id}/file")
def source_file(source_id: str) -> FileResponse:
    record = storage.get_source(source_id)
    if record is None or not record.path.is_file():
        raise HTTPException(status_code=404, detail="Source PDF not found.")
    return FileResponse(
        record.path,
        media_type="application/pdf",
        filename=record.filename,
        content_disposition_type="inline",
    )
