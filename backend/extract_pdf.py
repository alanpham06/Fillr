"""Extract native text from a digital PDF with PyMuPDF.

Proof of concept for the ingest pipeline: try embedded text first.
OCR (Tesseract) is a later fallback for image-only pages.

Usage:
    python extract_pdf.py path/to/lecture.pdf
    python extract_pdf.py path/to/lecture.pdf -o extracted.txt
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pymupdf


def extract_pages(pdf_path: Path) -> list[tuple[int, str]]:
    """Return (page_number, text) for each page. Page numbers are 1-based."""
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a .pdf file, got: {pdf_path.suffix}")

    document = pymupdf.open(pdf_path)
    try:
        pages: list[tuple[int, str]] = []
        for index, page in enumerate(document, start=1):
            text = page.get_text("text").strip()
            pages.append((index, text))
        return pages
    finally:
        document.close()


def render_txt(pages: list[tuple[int, str]]) -> str:
    blocks: list[str] = []
    for page_number, text in pages:
        body = text if text else "[no extractable text on this page]"
        blocks.append(f"--- Page {page_number} ---\n{body}")
    return "\n\n".join(blocks) + "\n"


def write_txt(pages: list[tuple[int, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_txt(pages), encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract text from a PDF into a .txt file")
    parser.add_argument("pdf", type=Path, help="Path to the PDF to extract")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Where to write the .txt file (default: next to the PDF)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    pdf_path = args.pdf.expanduser().resolve()
    output_path = (
        args.output.expanduser().resolve()
        if args.output
        else pdf_path.with_suffix(".txt")
    )

    try:
        pages = extract_pages(pdf_path)
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except pymupdf.FileDataError as exc:
        print(f"error: could not open PDF ({exc})", file=sys.stderr)
        return 1

    write_txt(pages, output_path)

    extracted = sum(1 for _, text in pages if text)
    print(f"Wrote {output_path}")
    print(f"Pages: {len(pages)} total, {extracted} with extractable text")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
