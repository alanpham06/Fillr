"""Stub lecture-template PDF generator. Does not call Nemotron."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

import pymupdf

from compile_latex import LatexCompileError, compile_tex
from config import OUTPUT_DIR, TEX_DIR
from models import Density, TextSize
from services.extractor import PageText
from services.storage import SourceRecord

_SAMPLE_PDFS = (
    (("cs449",), OUTPUT_DIR / "pitt-cs449-lecture-2-v2.pdf"),
)

_HEADING_SKIP = re.compile(
    r"^(\d+(\s*/\s*\d+)*|"
    r"page\s+\d+|"
    r"\d{1,2}/\d{1,2}/\d{2,4})$",
    re.IGNORECASE,
)


def generate_stub_pdf(
    source: SourceRecord,
    output_pdf: Path,
    *,
    density: Density,
    text_size: TextSize,
    include_diagrams: bool,
    include_code: bool,
) -> Path:
    """Return a real PDF: matching sample, compiled stub, or PyMuPDF fallback."""
    sample = _matching_sample(source.filename)
    if sample is not None:
        output_pdf.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(sample, output_pdf)
        return output_pdf

    tex_path = TEX_DIR / f"{output_pdf.stem}.tex"
    tex_path.parent.mkdir(parents=True, exist_ok=True)
    tex_path.write_text(
        build_stub_tex(
            source,
            density=density,
            text_size=text_size,
            include_diagrams=include_diagrams,
            include_code=include_code,
        ),
        encoding="utf-8",
    )

    try:
        return compile_tex(tex_path, output_pdf)
    except (FileNotFoundError, LatexCompileError):
        return write_simple_pdf(
            output_pdf,
            source,
            density=density,
            text_size=text_size,
            include_diagrams=include_diagrams,
            include_code=include_code,
        )


def _matching_sample(filename: str) -> Path | None:
    lowered = filename.lower().replace(" ", "")
    for tokens, path in _SAMPLE_PDFS:
        if path.is_file() and all(token in lowered for token in tokens):
            return path
    return None


def build_stub_tex(
    source: SourceRecord,
    *,
    density: Density,
    text_size: TextSize,
    include_diagrams: bool,
    include_code: bool,
) -> str:
    point, doc_class = {
        "small": ("11pt", "article"),
        "medium": ("12pt", "article"),
        "large": ("14pt", "extarticle"),
    }[text_size]
    blank_skip = "1.1em" if density == "more_full" else "2.4em"
    title = _title_from_filename(source.filename)
    settings = _settings_line(density, text_size, include_diagrams, include_code)
    headings = _headings(source.pages)
    cues = _cue_lines(source.pages, limit=8 if density == "more_full" else 4)
    excerpt = _first_page_excerpt(source.pages)

    sections: list[str] = [
        rf"\documentclass[{point}]{{{doc_class}}}",
        r"\usepackage[margin=0.85in]{geometry}",
        r"\usepackage{enumitem}",
        r"\usepackage{listings}",
        r"\usepackage{xcolor}",
        r"\usepackage{framed}",
        r"\lstset{basicstyle=\ttfamily\small,breaklines=true,frame=single,backgroundcolor=\color{gray!8}}",
        rf"\title{{{_tex_escape(title)}}}",
        r"\author{Lecture note template}",
        r"\date{}",
        r"\begin{document}",
        r"\maketitle",
        r"\begin{center}",
        r"\textit{Fill-in template --- not completed notes and not an answer key.}",
        r"\end{center}",
        rf"\noindent\textit{{{_tex_escape(settings)}}}",
        r"\vspace{1em}",
        r"\section*{How to use this sheet}",
        r"Use the headings as a lecture outline. Write in the blanks during class.",
        r"This preview was built locally without the language model; a later pass will",
        r"turn the extracted slides into a richer template.",
    ]

    if excerpt:
        sections.extend(
            [
                r"\section*{Cues from the first slide}",
                r"Capture these ideas in your own words. Do not treat this as a solution.",
                r"\begin{itemize}[leftmargin=*]",
            ]
        )
        for line in excerpt:
            if density == "more_full":
                sections.append(rf"  \item {_tex_escape(line)} \hrulefill")
            else:
                sections.append(rf"  \item {_tex_escape(_shorten(line, 42))} \hrulefill")
            sections.append(rf"  \vspace{{{blank_skip}}}")
        sections.append(r"\end{itemize}")

    if not headings:
        headings = ["Main ideas from this lecture"]

    for heading in headings:
        sections.append(rf"\section{{{_tex_escape(heading)}}}")
        sections.append(r"\begin{itemize}[leftmargin=*]")
        if density == "more_full":
            sections.append(r"  \item Key idea: \hrulefill")
            sections.append(rf"  \vspace{{{blank_skip}}}")
            sections.append(r"  \item Why it matters: \hrulefill")
            sections.append(rf"  \vspace{{{blank_skip}}}")
            sections.append(r"  \item Question to ask in lecture: \hrulefill")
        else:
            sections.append(r"  \item \hrulefill")
            sections.append(rf"  \vspace{{{blank_skip}}}")
            sections.append(r"  \item \hrulefill")
            sections.append(rf"  \vspace{{{blank_skip}}}")
        sections.append(r"\end{itemize}")

        if include_diagrams:
            sections.extend(
                [
                    rf"\noindent\textbf{{Diagram slot: {_tex_escape(heading)}}}",
                    r"\begin{framed}",
                    r"\begin{minipage}[t][0.22\textheight]{\textwidth}",
                    r"\vspace{0.4em}",
                    r"\textit{Sketch the idea. Label the parts. Leave it unfinished if needed.}",
                    r"\end{minipage}",
                    r"\end{framed}",
                    r"\vspace{1em}",
                ]
            )

        if include_code:
            sections.extend(
                [
                    r"\begin{lstlisting}",
                    "// Skeleton only --- fill in during lecture, do not paste a solution",
                    "________________",
                    "________________",
                    r"\end{lstlisting}",
                    r"\vspace{1em}",
                ]
            )

    if cues and density == "more_full":
        sections.extend(
            [
                r"\section*{Phrases to unpack}",
                r"\begin{itemize}[leftmargin=*]",
            ]
        )
        for cue in cues:
            sections.append(rf"  \item {_tex_escape(cue)} --- \hrulefill")
            sections.append(rf"  \vspace{{{blank_skip}}}")
        sections.append(r"\end{itemize}")

    sections.extend(
        [
            r"\vspace{2em}",
            r"\begin{center}",
            r"\textit{This template may not cover every topic from the source slides.}",
            r"\end{center}",
            r"\end{document}",
            "",
        ]
    )
    return "\n".join(sections)


def write_simple_pdf(
    output_pdf: Path,
    source: SourceRecord,
    *,
    density: Density,
    text_size: TextSize,
    include_diagrams: bool,
    include_code: bool,
) -> Path:
    """Last-resort PDF so Generate still returns a downloadable file."""
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    title = _title_from_filename(source.filename)
    settings = _settings_line(density, text_size, include_diagrams, include_code)
    headings = _headings(source.pages) or ["Main ideas from this lecture"]
    excerpt = _first_page_excerpt(source.pages)
    font = {"small": 10, "medium": 11, "large": 13}[text_size]
    blank_h = 28 if density == "more_full" else 46

    doc = pymupdf.open()
    page = doc.new_page()
    y = 64
    margin = 56
    width = page.rect.width - 2 * margin

    def new_page_if_needed(needed: float) -> None:
        nonlocal page, y
        if y + needed < page.rect.height - 56:
            return
        page = doc.new_page()
        y = 64

    def write(text: str, size: float, *, italic: bool = False) -> None:
        nonlocal y
        new_page_if_needed(size + 8)
        page.insert_text(
            (margin, y),
            text[:110],
            fontsize=size,
            fontname="helv" if not italic else "heit",
        )
        y += size + 8

    write(title, font + 6)
    write("Fill-in template — not completed notes and not an answer key.", font, italic=True)
    write(settings, font - 1, italic=True)
    y += 8
    write("Cues from the first slide", font + 2)
    for line in excerpt:
        write(f"• {line}", font)
        new_page_if_needed(blank_h)
        page.draw_line(pymupdf.Point(margin + 16, y + 10), pymupdf.Point(margin + width, y + 10))
        y += blank_h

    for heading in headings:
        write(heading, font + 2)
        for _ in range(2):
            new_page_if_needed(blank_h)
            page.draw_line(pymupdf.Point(margin, y + 10), pymupdf.Point(margin + width, y + 10))
            y += blank_h
        if include_diagrams:
            write(f"Diagram slot: {heading}", font, italic=True)
            new_page_if_needed(90)
            rect = pymupdf.Rect(margin, y, margin + width, y + 80)
            page.draw_rect(rect)
            y += 96
        if include_code:
            write("Code skeleton (fill in during lecture)", font, italic=True)
            new_page_if_needed(56)
            page.draw_rect(pymupdf.Rect(margin, y, margin + width, y + 48))
            y += 64

    y += 16
    write("This template may not cover every topic from the source slides.", font, italic=True)
    doc.save(output_pdf)
    doc.close()
    return output_pdf


def _title_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    cleaned = re.sub(r"[-_]+", " ", stem).strip()
    return f"{cleaned} — note template" if cleaned else "Lecture note template"


def _settings_line(
    density: Density,
    text_size: TextSize,
    include_diagrams: bool,
    include_code: bool,
) -> str:
    density_label = "more filled in" if density == "more_full" else "more blank"
    diagrams = "diagrams on" if include_diagrams else "diagrams off"
    code = "code blocks on" if include_code else "code blocks off"
    return f"Settings: {density_label} · {text_size} text · {diagrams} · {code}"


def _headings(pages: list[PageText]) -> list[str]:
    seen: set[str] = set()
    headings: list[str] = []
    for page in pages:
        for raw in page.text.splitlines():
            line = _clean_line(raw)
            if not line or len(line) > 68:
                continue
            if _HEADING_SKIP.match(line):
                continue
            if line.lower() in seen:
                continue
            words = line.split()
            if not (2 <= len(words) <= 10):
                continue
            if line.endswith((".", ",", ";")):
                continue
            seen.add(line.lower())
            headings.append(line)
            if len(headings) >= 8:
                return headings
    return headings


def _cue_lines(pages: list[PageText], limit: int) -> list[str]:
    cues: list[str] = []
    for page in pages:
        for raw in page.text.splitlines():
            line = _clean_line(raw)
            if not line or len(line) < 16 or len(line) > 90:
                continue
            if _HEADING_SKIP.match(line):
                continue
            cues.append(_shorten(line, 80))
            if len(cues) >= limit:
                return cues
    return cues


def _first_page_excerpt(pages: list[PageText], limit: int = 6) -> list[str]:
    if not pages:
        return []
    lines: list[str] = []
    for raw in pages[0].text.splitlines():
        line = _clean_line(raw)
        if not line or _HEADING_SKIP.match(line):
            continue
        if len(line) < 8:
            continue
        lines.append(_shorten(line, 88))
        if len(lines) >= limit:
            break
    return lines


def _clean_line(raw: str) -> str:
    line = raw.replace("\u00a0", " ")
    line = re.sub(r"\s+", " ", line).strip()
    return line


def _shorten(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _tex_escape(text: str) -> str:
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(char, char) for char in text)
