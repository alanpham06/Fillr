"""In-memory source and template records, files on disk."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from uuid import uuid4

from config import GENERATED_DIR, UPLOAD_DIR, ensure_data_dirs
from services.extractor import PageText


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


_sources: dict[str, SourceRecord] = {}
_templates: dict[str, TemplateRecord] = {}


def write_upload(filename: str, content: bytes) -> tuple[str, Path]:
    """Store the raw PDF and return (id, path) before extraction."""
    ensure_data_dirs()
    source_id = uuid4().hex
    path = UPLOAD_DIR / f"{source_id}.pdf"
    path.write_bytes(content)
    return source_id, path


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


def save_template(source_id: str, pdf_path: Path, settings: dict) -> TemplateRecord:
    record = TemplateRecord(
        id=pdf_path.stem,
        source_id=source_id,
        path=pdf_path,
        settings=settings,
    )
    _templates[record.id] = record
    return record


def new_template_path() -> Path:
    ensure_data_dirs()
    return GENERATED_DIR / f"{uuid4().hex}.pdf"


def get_template(template_id: str) -> TemplateRecord | None:
    return _templates.get(template_id)
