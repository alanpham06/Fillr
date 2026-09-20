"""Verify native-text pages skip OCR, and image-only paths use Tesseract.

Run from backend/:
    python tests/test_ocr_pipeline.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import pymupdf
from PIL import Image

from services.extractor import FallbackExtractor
from services.notes import assign_heuristic, extract_slot_labels, inject_student_text
from services.ocr import needs_ocr

SAMPLE = BACKEND / "samples" / "pitt-cs449-lecture-2.pdf"


def _fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def test_native_pdf_skips_ocr() -> None:
    if not SAMPLE.is_file():
        _fail(f"missing sample {SAMPLE}")
    pages = FallbackExtractor().extract(SAMPLE)
    if not pages:
        _fail("expected pages from the sample PDF")
    ocr_pages = [page for page in pages if page.method == "tesseract"]
    if ocr_pages:
        _fail(
            f"digital sample was OCRed on pages "
            f"{[page.page_number for page in ocr_pages]}"
        )
    if not any(page.text and page.method == "pymupdf" for page in pages):
        _fail("expected native PyMuPDF text")
    print(f"ok native PDF: {len(pages)} pages, all pymupdf")


def test_image_uses_tesseract(tmp_path: Path) -> None:
    png = _raster_sample_page(tmp_path)
    pages = FallbackExtractor().extract(png)
    if len(pages) != 1 or pages[0].method != "tesseract":
        _fail(f"image should go to Tesseract, got {pages}")
    if needs_ocr(pages[0].text):
        _fail(f"Tesseract returned almost no text: {pages[0].text!r}")
    print(f"ok image OCR ({len(pages[0].text)} chars)")


def test_image_only_pdf_uses_tesseract(tmp_path: Path) -> None:
    png = _raster_sample_page(tmp_path)
    pdf_path = tmp_path / "image-only.pdf"
    src = pymupdf.open(png)
    try:
        rect = src[0].rect
        doc = pymupdf.open()
        page = doc.new_page(width=rect.width, height=rect.height)
        page.insert_image(page.rect, filename=str(png))
        native = page.get_text("text").strip()
        if native:
            _fail(f"image-only PDF unexpectedly has native text: {native!r}")
        doc.save(pdf_path)
        doc.close()
    finally:
        src.close()

    pages = FallbackExtractor().extract(pdf_path)
    if not pages or pages[0].method != "tesseract":
        _fail(f"image-only PDF should OCR, got {pages}")
    if needs_ocr(pages[0].text):
        _fail(f"OCR of image-only PDF was empty: {pages[0].text!r}")
    print(f"ok image-only PDF OCR ({len(pages[0].text)} chars)")


def test_forced_ocr_on_digital_pdf(tmp_path: Path) -> None:
    one = tmp_path / "one-page.pdf"
    src = pymupdf.open(SAMPLE)
    try:
        out = pymupdf.open()
        out.insert_pdf(src, from_page=0, to_page=0)
        out.save(one)
        out.close()
    finally:
        src.close()
    pages = FallbackExtractor().extract_ocr(one)
    if not pages or any(page.method != "tesseract" for page in pages):
        _fail("extract_ocr should mark every page tesseract")
    if needs_ocr(pages[0].text):
        _fail("forced OCR of the sample returned almost no text")
    print(f"ok forced OCR: {len(pages)} page(s)")


def test_heuristic_fill() -> None:
    tex = r"""
\documentclass{article}
\usepackage{xcolor}
\begin{document}
\deflabel{What tar is for:}
\vspace{0.14\textheight}
\deflabel{argv[0] is:}
\vspace{0.10\textheight}
\end{document}
"""
    labels = extract_slot_labels(tex)
    if "What tar is for" not in labels and "What tar is for:" not in labels:
        _fail(f"did not parse labels: {labels}")
    assigned = assign_heuristic(
        labels,
        "tar is for bundling files\n\nargv[0] is the program name",
    )
    filled = inject_student_text(tex, assigned)
    if r"\color{studentink}" not in filled:
        _fail("filled tex missing student ink")
    if "bundling" not in filled.lower() and "program" not in filled.lower():
        _fail(f"student text was not inserted: {filled}")
    print("ok heuristic fill")


def _raster_sample_page(tmp_path: Path) -> Path:
    if not SAMPLE.is_file():
        _fail(f"missing sample {SAMPLE}")
    doc = pymupdf.open(SAMPLE)
    try:
        pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
    finally:
        doc.close()
    png = tmp_path / "slide.png"
    pix.save(str(png))
    Image.open(png).close()
    return png


def main() -> int:
    test_native_pdf_skips_ocr()
    test_heuristic_fill()
    with tempfile.TemporaryDirectory() as raw:
        tmp = Path(raw)
        test_image_uses_tesseract(tmp)
        test_image_only_pdf_uses_tesseract(tmp)
        test_forced_ocr_on_digital_pdf(tmp)
    print("all extractor checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
