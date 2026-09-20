"""Upload lecture PDFs or images and extract text (PyMuPDF, Tesseract fallback)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from config import MAX_UPLOAD_BYTES
from models import IngestResponse, PageExtractInfo
from services import storage
from services.extractor import ExtractionError, TextExtractor, get_extractor
from services.ocr import IMAGE_SUFFIXES
from services.storage import ALLOWED_UPLOAD_SUFFIXES

router = APIRouter()

_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
}


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    file: UploadFile = File(...),
    extractor: TextExtractor = Depends(get_extractor),
) -> IngestResponse:
    filename = file.filename or "lecture.pdf"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        raise HTTPException(
            status_code=422,
            detail="Please upload a PDF or an image (png, jpg).",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 25 MB.")

    source_id, dest = storage.write_upload(filename, content)
    try:
        pages = extractor.extract(dest)
    except ExtractionError as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    preview = dest
    if dest.suffix.lower() in IMAGE_SUFFIXES:
        try:
            preview = storage.image_to_preview_pdf(dest)
        except Exception as exc:
            dest.unlink(missing_ok=True)
            raise HTTPException(
                status_code=422,
                detail=f"Could not build a PDF preview of that image: {exc}",
            ) from exc

    record = storage.put_source(source_id, filename, preview, pages)
    return IngestResponse(
        id=record.id,
        filename=record.filename,
        page_count=record.page_count,
        file_url=f"/sources/{record.id}/file",
        pages=[
            PageExtractInfo(
                page_number=page.page_number,
                method=page.method,  # type: ignore[arg-type]
                char_count=len(page.text),
            )
            for page in pages
        ],
    )


@router.get("/sources/{source_id}/file")
def source_file(source_id: str) -> FileResponse:
    record = storage.get_source(source_id)
    if record is None or not record.path.is_file():
        raise HTTPException(status_code=404, detail="Source file not found.")
    media = _MEDIA_TYPES.get(record.path.suffix.lower(), "application/octet-stream")
    return FileResponse(
        record.path,
        media_type=media,
        filename=record.filename,
        content_disposition_type="inline",
    )
