"""Swappable text extractor: PyMuPDF first, Tesseract when a page is image-only."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import pymupdf

from extract_pdf import extract_pages
from services.ocr import (
    IMAGE_SUFFIXES,
    OcrError,
    is_image_path,
    needs_ocr,
    ocr_image_file,
    ocr_pdf_page,
)

PDF_SUFFIXES = {".pdf"}
ALLOWED_SUFFIXES = PDF_SUFFIXES | IMAGE_SUFFIXES


class ExtractionError(Exception):
    pass


@dataclass(frozen=True)
class PageText:
    page_number: int
    text: str
    method: str = "pymupdf"


class TextExtractor(Protocol):
    def extract(self, path: Path) -> list[PageText]:
        """Return page text for a stored PDF or image."""

    def extract_ocr(self, path: Path) -> list[PageText]:
        """Always OCR (used when re-uploading handwritten notes)."""


class PyMuPDFExtractor:
    """Native PDF text only. Images and empty pages stay empty."""

    def extract(self, path: Path) -> list[PageText]:
        try:
            pages = extract_pages(path)
        except FileNotFoundError as exc:
            raise ExtractionError(str(exc)) from exc
        except ValueError as exc:
            raise ExtractionError(str(exc)) from exc
        except pymupdf.FileDataError as exc:
            raise ExtractionError(f"Could not open PDF: {exc}") from exc
        return [
            PageText(page_number=number, text=text, method="pymupdf")
            for number, text in pages
        ]

    def extract_ocr(self, path: Path) -> list[PageText]:
        raise ExtractionError("PyMuPDFExtractor does not OCR.")


class FallbackExtractor:
    """PyMuPDF per page; Tesseract if that page has almost no native text.

    Images skip PyMuPDF and go straight to Tesseract.
    """

    def extract(self, path: Path) -> list[PageText]:
        suffix = path.suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            raise ExtractionError(
                f"Unsupported file type {suffix or '(none)'}. "
                "Upload a PDF or an image (png, jpg)."
            )
        if is_image_path(path):
            return [self._ocr_image(path, page_number=1)]
        return self._extract_pdf(path, force_ocr=False)

    def extract_ocr(self, path: Path) -> list[PageText]:
        suffix = path.suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            raise ExtractionError(
                f"Unsupported file type {suffix or '(none)'}. "
                "Upload a PDF or an image (png, jpg)."
            )
        if is_image_path(path):
            return [self._ocr_image(path, page_number=1)]
        return self._extract_pdf(path, force_ocr=True)

    def _ocr_image(self, path: Path, page_number: int) -> PageText:
        try:
            text = ocr_image_file(path)
        except OcrError as exc:
            raise ExtractionError(str(exc)) from exc
        except FileNotFoundError as exc:
            raise ExtractionError(str(exc)) from exc
        except OSError as exc:
            raise ExtractionError(f"Could not open image: {exc}") from exc
        return PageText(page_number=page_number, text=text, method="tesseract")

    def _extract_pdf(self, path: Path, *, force_ocr: bool) -> list[PageText]:
        if not path.is_file():
            raise ExtractionError(f"PDF not found: {path}")
        try:
            document = pymupdf.open(path)
        except pymupdf.FileDataError as exc:
            raise ExtractionError(f"Could not open PDF: {exc}") from exc

        pages: list[PageText] = []
        try:
            for index, page in enumerate(document, start=1):
                if force_ocr:
                    pages.append(self._ocr_pdf_page(page, index))
                    continue
                native = page.get_text("text").strip()
                if needs_ocr(native):
                    pages.append(self._ocr_pdf_page(page, index))
                else:
                    pages.append(
                        PageText(page_number=index, text=native, method="pymupdf")
                    )
        finally:
            document.close()
        return pages

    def _ocr_pdf_page(self, page: pymupdf.Page, page_number: int) -> PageText:
        try:
            text = ocr_pdf_page(page)
        except OcrError as exc:
            raise ExtractionError(str(exc)) from exc
        return PageText(page_number=page_number, text=text, method="tesseract")


def get_extractor() -> TextExtractor:
    return FallbackExtractor()
