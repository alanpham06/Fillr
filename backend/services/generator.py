"""Lecture-template PDF generator.

Only path: Nemotron (services.llm) returns a JSON note-sheet spec, which
services.latex_render turns into compile-ready LaTeX, then Tectonic compiles it.
If the model is unconfigured, unreachable, returns unusable output, or the
compile fails, generation raises TemplateGenerationError so the API surfaces a
real error rather than a misleading local stub.

The stub builders below are retained only as a template source for the
notes-merge path (services.notes) when a template's .tex is missing; they are
no longer used to answer a Generate request.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import pymupdf

from compile_latex import LatexCompileError, compile_tex
from config import TEX_DIR
from models import Density, TextSize
from services import latex_render, llm
from services.extractor import PageText
from services.latex_style import INK_RGB, SLOTDEF_RGB, SLOTDRAW_RGB, preamble_lines
from services.storage import SourceRecord

logger = logging.getLogger(__name__)

# How many times to try the model (each try = one generation + one compile)
# before giving up and raising.
LLM_ATTEMPTS = 2


class TemplateGenerationError(RuntimeError):
    """Raised when a real (Nemotron-backed) template could not be produced.

    The message is user-facing: the API returns it as the error detail instead
    of silently serving a local stub.
    """


@dataclass
class GenerationResult:
    """Outcome of a successful template generation."""

    path: Path
    used_llm: bool = True


def generate_template_pdf(
    source: SourceRecord,
    output_pdf: Path,
    *,
    density: Density,
    text_size: TextSize,
    include_diagrams: bool,
    include_code: bool,
) -> GenerationResult:
    """Generate the template via Nemotron. Raises TemplateGenerationError if the
    model is unconfigured, unreachable, returns unusable output, or the compile
    fails — the caller turns that into an API error rather than a stub PDF."""
    if not llm.is_configured():
        raise TemplateGenerationError(
            "Note generation is unavailable: the language model is not configured "
            "(NVIDIA_API_KEY is not set). Start the Nemotron backend and set the key, "
            "then try again."
        )

    # The model is stochastic: an occasional reply omits \end{document} or emits
    # LaTeX that will not compile. Retry once before giving up.
    last_exc: Exception | None = None
    for attempt in range(1, LLM_ATTEMPTS + 1):
        try:
            spec = llm.generate_template_spec(
                source.pages,
                density=density,
                text_size=text_size,
                include_diagrams=include_diagrams,
                include_code=include_code,
            )
            latex = latex_render.render_template(
                spec,
                density=density,
                text_size=text_size,
                include_diagrams=include_diagrams,
                include_code=include_code,
            )
            tex_path = TEX_DIR / f"{output_pdf.stem}.tex"
            tex_path.parent.mkdir(parents=True, exist_ok=True)
            tex_path.write_text(latex, encoding="utf-8")
            pdf = compile_tex(tex_path, output_pdf)
            return GenerationResult(path=pdf)
        except (llm.LLMError, LatexCompileError, FileNotFoundError, ValueError) as exc:
            last_exc = exc
            logger.warning("Nemotron attempt %d/%d failed: %s", attempt, LLM_ATTEMPTS, exc)

    raise TemplateGenerationError(
        f"Could not generate a note template after {LLM_ATTEMPTS} attempts: {last_exc}"
    ) from last_exc

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
    """Return a real PDF: compiled stub, or PyMuPDF fallback."""
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
        *preamble_lines(),
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
        if density == "more_full":
            slot_labels = ["Key idea:", "Why it matters:", "Question to ask in lecture:"]
        else:
            slot_labels = ["Notes:", ""]
        for slot in slot_labels:
            sections.append(r"\Needspace{0.16\textheight}")
            if slot:
                sections.append(rf"\deflabel{{{_tex_escape(slot)}}}")
            sections.append(rf"\vspace{{{blank_skip}}}")

        if include_diagrams:
            sections.extend(
                [
                    r"\Needspace{0.28\textheight}",
                    rf"\drawlabel{{Picture: {_tex_escape(heading)}}}",
                    r"{\color{slotdraw}",
                    r"\begin{framed}",
                    r"\color{ink}",
                    r"\begin{minipage}[t][0.22\textheight]{\textwidth}",
                    r"\vspace{0.4em}",
                    r"\textit{Sketch the idea. Label the parts. Leave it unfinished if needed.}",
                    r"\end{minipage}",
                    r"\end{framed}",
                    r"}",
                    r"\vspace{1em}",
                ]
            )

        if include_code:
            sections.extend(
                [
                    r"\Needspace{0.18\textheight}",
                    r"\drawlabel{Code:}",
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

    def write(text: str, size: float, *, italic: bool = False, color=INK_RGB) -> None:
        nonlocal y
        new_page_if_needed(size + 8)
        page.insert_text(
            (margin, y),
            text[:110],
            fontsize=size,
            fontname="helv" if not italic else "heit",
            color=color,
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
        write("Key idea:", font, color=SLOTDEF_RGB)
        for _ in range(2):
            new_page_if_needed(blank_h)
            page.draw_line(pymupdf.Point(margin, y + 10), pymupdf.Point(margin + width, y + 10))
            y += blank_h
        if include_diagrams:
            write(f"Picture: {heading}", font, italic=True, color=SLOTDRAW_RGB)
            new_page_if_needed(90)
            rect = pymupdf.Rect(margin, y, margin + width, y + 80)
            page.draw_rect(rect, color=SLOTDRAW_RGB)
            y += 96
        if include_code:
            write("Code:", font, italic=True, color=SLOTDRAW_RGB)
            new_page_if_needed(56)
            page.draw_rect(
                pymupdf.Rect(margin, y, margin + width, y + 48),
                color=SLOTDRAW_RGB,
            )
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
