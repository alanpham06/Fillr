"""Tesseract helpers used by the swappable TextExtractor.

Route handlers must not call this module directly.
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
from PIL import Image

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp", ".bmp"}

# A digital slide almost always has more than this many letters/digits.
# Scanned / image-only pages typically have none.
MIN_NATIVE_ALNUM = 40

# Render PDF pages a bit larger so printed text OCRs more cleanly.
PDF_OCR_ZOOM = 2.0


class OcrError(RuntimeError):
    pass


def is_image_path(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_SUFFIXES


def meaningful_len(text: str) -> int:
    return sum(1 for char in text if char.isalnum())


def needs_ocr(native_text: str) -> bool:
    return meaningful_len(native_text) < MIN_NATIVE_ALNUM


def require_tesseract() -> None:
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
    except Exception as exc:
        raise OcrError(
            "Tesseract is not available. In the steelhacks conda env run:\n"
            "  conda install -n steelhacks -c conda-forge tesseract\n"
            "  pip install pytesseract pillow"
        ) from exc


def ocr_pil_image(image: Image.Image) -> str:
    require_tesseract()
    import pytesseract

    rgb = image.convert("RGB")
    return pytesseract.image_to_string(rgb).strip()


def ocr_image_file(path: Path) -> str:
    if not path.is_file():
        raise OcrError(f"Image not found: {path}")
    with Image.open(path) as image:
        return ocr_pil_image(image)


def ocr_pdf_page(page: pymupdf.Page) -> str:
    pix = page.get_pixmap(matrix=pymupdf.Matrix(PDF_OCR_ZOOM, PDF_OCR_ZOOM), alpha=False)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    return ocr_pil_image(image)
