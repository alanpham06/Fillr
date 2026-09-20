"""In-memory source and template records, files on disk."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from uuid import uuid4

import pymupdf

from config import GENERATED_DIR, UPLOAD_DIR, ensure_data_dirs
from services.extractor import PageText
from services.ocr import IMAGE_SUFFIXES

ALLOWED_UPLOAD_SUFFIXES = {".pdf"} | IMAGE_SUFFIXES


@dataclass
class SourceRecord:
    id: str
    filename: str
    path: Path
    page_count: int
    pages: list[PageText]


@dataclass
class TemplateRecord:
    id: str
    source_id: str
    path: Path
    settings: dict = field(default_factory=dict)
    tex_path: Path | None = None
    filled_id: str | None = None
    filled_path: Path | None = None
    filled_tex_path: Path | None = None
    fill_mapper: str | None = None


_sources: dict[str, SourceRecord] = {}
_templates: dict[str, TemplateRecord] = {}


def write_upload(filename: str, content: bytes) -> tuple[str, Path]:
    """Store the raw upload and return (id, path) before extraction."""
    ensure_data_dirs()
    source_id = uuid4().hex
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        suffix = ".pdf"
    path = UPLOAD_DIR / f"{source_id}{suffix}"
    path.write_bytes(content)
    return source_id, path


def write_notes_upload(filename: str, content: bytes) -> Path:
    ensure_data_dirs()
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        suffix = ".pdf"
    path = UPLOAD_DIR / f"notes-{uuid4().hex}{suffix}"
    path.write_bytes(content)
    return path


def image_to_preview_pdf(image_path: Path) -> Path:
    """Wrap a raster image in a one-page PDF so the React preview can show it."""
    pdf_path = image_path.with_suffix(".pdf")
    src = pymupdf.open(image_path)
    try:
        rect = src[0].rect
        doc = pymupdf.open()
        page = doc.new_page(width=rect.width, height=rect.height)
        page.insert_image(page.rect, filename=str(image_path))
        doc.save(pdf_path)
        doc.close()
    finally:
        src.close()
    return pdf_path


def put_source(
    source_id: str,
    filename: str,
    path: Path,
    pages: list[PageText],
) -> SourceRecord:
    record = SourceRecord(
        id=source_id,
        filename=filename,
        path=path,
        page_count=len(pages),
        pages=pages,
    )
    _sources[source_id] = record
    return record


def get_source(source_id: str) -> SourceRecord | None:
    return _sources.get(source_id)


def save_template(
    source_id: str,
    pdf_path: Path,
    settings: dict,
    tex_path: Path | None = None,
) -> TemplateRecord:
    record = TemplateRecord(
        id=pdf_path.stem,
        source_id=source_id,
        path=pdf_path,
        settings=settings,
        tex_path=tex_path,
    )
    _templates[record.id] = record
    return record


def save_filled(
    template: TemplateRecord,
    pdf_path: Path,
    *,
    tex_path: Path | None = None,
    mapper: str = "heuristic",
) -> TemplateRecord:
    template.filled_id = pdf_path.stem
    template.filled_path = pdf_path
    template.filled_tex_path = tex_path
    template.fill_mapper = mapper
    filled = TemplateRecord(
        id=pdf_path.stem,
        source_id=template.source_id,
        path=pdf_path,
        settings={**(template.settings or {}), "kind": "filled", "parent": template.id},
        tex_path=tex_path,
        fill_mapper=mapper,
    )
    _templates[filled.id] = filled
    _templates[template.id] = template
    return filled


def new_template_path() -> Path:
    ensure_data_dirs()
    return GENERATED_DIR / f"{uuid4().hex}.pdf"


def get_template(template_id: str) -> TemplateRecord | None:
    return _templates.get(template_id)
