"""Swappable text extractor: PyMuPDF first. OCR is a later fallback."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import pymupdf

from extract_pdf import extract_pages


class ExtractionError(Exception):
    pass


@dataclass(frozen=True)
class PageText:
    page_number: int
    text: str


class TextExtractor(Protocol):
    def extract(self, path: Path) -> list[PageText]:
        """Return page text for a stored PDF."""


class PyMuPDFExtractor:
    def extract(self, path: Path) -> list[PageText]:
        try:
            pages = extract_pages(path)
        except FileNotFoundError as exc:
            raise ExtractionError(str(exc)) from exc
        except ValueError as exc:
            raise ExtractionError(str(exc)) from exc
        except pymupdf.FileDataError as exc:
            raise ExtractionError(f"Could not open PDF: {exc}") from exc
        return [PageText(page_number=number, text=text) for number, text in pages]


def get_extractor() -> TextExtractor:
    return PyMuPDFExtractor()
