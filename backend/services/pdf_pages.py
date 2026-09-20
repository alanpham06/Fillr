"""Rasterize PDF pages and flatten workspace ink / typed notes onto a copy."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pymupdf

from config import GENERATED_DIR, PAGES_DIR, ensure_data_dirs
from models import WorkspaceExportRequest, WorkspaceKind
from services import storage

PAGE_RENDER_ZOOM = 2.0


class WorkspaceDocumentError(Exception):
    """The requested source/template PDF is missing or a page is out of range."""


def pdf_page_count(path: Path) -> int:
    document = pymupdf.open(path)
    try:
        return document.page_count
    finally:
        document.close()


def resolve_document(kind: WorkspaceKind, document_id: str) -> Path:
    if kind == "source":
        record = storage.get_source(document_id)
        if record is None or not record.path.is_file():
            raise WorkspaceDocumentError("Source file not found.")
        return record.path

    record = storage.get_template(document_id)
    if record is None:
        raise WorkspaceDocumentError("Template not found.")

    if kind == "filled":
        path = record.filled_path if record.filled_path and record.filled_path.is_file() else None
        if path is None and record.path.is_file() and (record.settings or {}).get("kind") == "filled":
            path = record.path
        if path is None:
            raise WorkspaceDocumentError("No filled notes for this template yet.")
        return path

    if not record.path.is_file():
        raise WorkspaceDocumentError("Template PDF not found.")
    return record.path


def render_page_png(kind: WorkspaceKind, document_id: str, page_number: int) -> Path:
    pdf_path = resolve_document(kind, document_id)
    if page_number < 1:
        raise WorkspaceDocumentError("Page number must be 1 or greater.")

    ensure_data_dirs()
    cache = PAGES_DIR / f"{kind}-{document_id}-p{page_number}.png"
    pdf_mtime = pdf_path.stat().st_mtime
    if cache.is_file() and cache.stat().st_mtime >= pdf_mtime:
        return cache

    document = pymupdf.open(pdf_path)
    try:
        if page_number > document.page_count:
            raise WorkspaceDocumentError("That page is not in this PDF.")
        page = document[page_number - 1]
        pix = page.get_pixmap(
            matrix=pymupdf.Matrix(PAGE_RENDER_ZOOM, PAGE_RENDER_ZOOM),
            alpha=False,
        )
        pix.save(str(cache))
    finally:
        document.close()
    return cache


def flatten_annotations(body: WorkspaceExportRequest) -> Path:
    pdf_path = resolve_document(body.kind, body.id)
    ensure_data_dirs()
    dest = GENERATED_DIR / f"{uuid4().hex}-annotated.pdf"

    document = pymupdf.open(pdf_path)
    try:
        for page_export in body.pages:
            if page_export.page < 1 or page_export.page > document.page_count:
                continue
            page = document[page_export.page - 1]
            width = page.rect.width
            height = page.rect.height
            for stroke in page_export.strokes:
                if stroke.tool == "eraser":
                    continue
                opacity = stroke.opacity
                if stroke.tool == "highlighter" and opacity >= 1:
                    opacity = 0.38
                _draw_stroke(
                    page,
                    stroke.points,
                    stroke.color,
                    stroke.width * width,
                    opacity,
                )
            for box in page_export.texts:
                if not box.text.strip():
                    continue
                fontsize = max(6.0, box.font_size * height)
                rect = pymupdf.Rect(
                    box.x * width,
                    box.y * height,
                    (box.x + box.width) * width,
                    (box.y + box.height) * height,
                )
                if rect.width < 8 or rect.height < 8:
                    continue
                page.insert_textbox(
                    rect,
                    box.text,
                    fontsize=fontsize,
                    fontname=_text_font(box.bold, box.italic),
                    color=_hex_rgb(box.color),
                    align=pymupdf.TEXT_ALIGN_LEFT,
                )
        document.save(dest)
    finally:
        document.close()
    return dest


def _text_font(bold: bool, italic: bool) -> str:
    if bold and italic:
        return "hebi"
    if bold:
        return "hebo"
    if italic:
        return "heit"
    return "helv"


def _draw_stroke(page: pymupdf.Page, points, color: str, width: float, opacity: float = 1.0) -> None:
    mapped = [pymupdf.Point(point.x * page.rect.width, point.y * page.rect.height) for point in points]
    if not mapped:
        return
    shape = page.new_shape()
    alpha = max(0.0, min(1.0, opacity))
    rgb = _hex_rgb(color)
    if len(mapped) == 1:
        shape.draw_circle(mapped[0], max(width / 2, 0.4))
        shape.finish(color=rgb, fill=rgb, width=0, stroke_opacity=alpha, fill_opacity=alpha)
    else:
        shape.draw_polyline(mapped)
        shape.finish(
            color=rgb,
            width=max(width, 0.4),
            lineCap=1,
            lineJoin=1,
            closePath=False,
            stroke_opacity=alpha,
            fill_opacity=alpha,
        )
    shape.commit()


def _hex_rgb(color: str) -> tuple[float, float, float]:
    raw = color.strip().lstrip("#")
    if len(raw) == 3:
        raw = "".join(char * 2 for char in raw)
    if len(raw) != 6:
        return (0.07, 0.07, 0.07)
    try:
        red = int(raw[0:2], 16) / 255
        green = int(raw[2:4], 16) / 255
        blue = int(raw[4:6], 16) / 255
    except ValueError:
        return (0.07, 0.07, 0.07)
    return (red, green, blue)
