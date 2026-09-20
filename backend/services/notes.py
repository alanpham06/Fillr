"""Merge OCR'd student notes back into a generated lecture template."""

from __future__ import annotations

import re
from pathlib import Path

from compile_latex import LatexCompileError, compile_tex
from config import TEX_DIR
from services.extractor import ExtractionError, PageText, TextExtractor
from services.generator import _tex_escape, build_stub_tex
from services.latex_style import ensure_color_preamble
from services.nemotron import map_ocr_to_slots
from services.storage import SourceRecord, TemplateRecord

_LABEL_PATTERNS = (
    re.compile(r"\\(?:sub)?section\*?\{([^}]+)\}"),
    re.compile(r"\\deflabel\{([^}]+)\}"),
    re.compile(r"\\drawlabel\{([^}]+)\}"),
    re.compile(r"\\noindent\\textbf\{([^}]+)\}"),
    re.compile(r"\\textbf\{([^}]+)\}"),
)
_SKIP_LABELS = {
    "how to use this sheet",
    "cues from the first slide",
    "phrases to unpack",
    "lecture note template",
}
_STOP = {"the", "a", "an", "of", "to", "and", "or", "is", "for", "in", "on", "it"}


class NotesFillError(Exception):
    pass


def fill_template_from_notes(
    template: TemplateRecord,
    source: SourceRecord,
    notes_path: Path,
    output_pdf: Path,
    extractor: TextExtractor,
) -> tuple[Path, Path, str, list[PageText]]:
    """OCR the upload, inject student ink into the last .tex, compile.

    Returns (pdf, tex, mapper, ocr_pages). mapper is heuristic or nemotron.
    """
    try:
        pages = extractor.extract_ocr(notes_path)
    except ExtractionError as exc:
        raise NotesFillError(str(exc)) from exc

    ocr_text = "\n\n".join(page.text for page in pages if page.text).strip()
    if not ocr_text:
        raise NotesFillError(
            "OCR found no readable text. Handwriting is often faint; "
            "try a sharper photo or a higher-contrast scan."
        )

    tex = _load_template_tex(template, source)
    tex = ensure_color_preamble(tex)
    labels = extract_slot_labels(tex)
    assigned, mapper = _assign_text(labels, ocr_text)
    filled = inject_student_text(tex, assigned)

    tex_path = TEX_DIR / f"{output_pdf.stem}.tex"
    tex_path.parent.mkdir(parents=True, exist_ok=True)
    tex_path.write_text(filled, encoding="utf-8")

    try:
        compile_tex(tex_path, output_pdf)
    except (FileNotFoundError, LatexCompileError) as exc:
        raise NotesFillError(f"Could not compile the filled template: {exc}") from exc
    return output_pdf, tex_path, mapper, pages


def extract_slot_labels(tex: str) -> list[str]:
    seen: set[str] = set()
    labels: list[str] = []
    for pattern in _LABEL_PATTERNS:
        for match in pattern.finditer(tex):
            label = _clean_label(match.group(1))
            key = label.lower()
            if not label or key in seen or key in _SKIP_LABELS:
                continue
            seen.add(key)
            labels.append(label)
    return labels


def inject_student_text(tex: str, assignments: dict[str, str]) -> str:
    leftover = assignments.get("_unassigned", "").strip()
    pending = {
        label: text.strip()
        for label, text in assignments.items()
        if label != "_unassigned" and text.strip()
    }
    used: set[str] = set()
    out: list[str] = []

    for line in tex.splitlines():
        out.append(line)
        if r"\end{document}" in line:
            continue
        for label, text in pending.items():
            if label in used:
                continue
            if _line_has_label(line, label):
                out.extend(_student_block(text))
                used.add(label)
                break

    unused = [text for label, text in pending.items() if label not in used]
    extra = [chunk for chunk in (*unused, leftover) if chunk]
    if extra:
        out = _insert_before_end(
            out,
            [
                r"\vspace{1.2em}",
                r"\Needspace{0.18\textheight}",
                r"\deflabel{Additional notes (OCR):}",
                *_student_block("\n\n".join(extra)),
                r"\vspace{0.6em}",
                r"\begin{center}",
                r"\textit{Teal text is OCR of your handwriting and may be imperfect.}",
                r"\end{center}",
            ],
        )
    elif r"OCR of your handwriting" not in tex:
        out = _insert_before_end(
            out,
            [
                r"\vspace{1em}",
                r"\begin{center}",
                r"\textit{Teal text is OCR of your handwriting and may be imperfect.}",
                r"\end{center}",
            ],
        )
    return "\n".join(out) + "\n"


def _assign_text(labels: list[str], ocr_text: str) -> tuple[dict[str, str], str]:
    mapped = map_ocr_to_slots(labels, ocr_text)
    if mapped:
        return mapped, "nemotron"
    return assign_heuristic(labels, ocr_text), "heuristic"


def assign_heuristic(labels: list[str], ocr_text: str) -> dict[str, str]:
    paragraphs = _paragraphs(ocr_text)
    assigned: dict[str, str] = {label: "" for label in labels}
    remaining = list(paragraphs)

    for label in labels:
        tokens = set(_normalize(label).split()) - _STOP
        if not tokens:
            continue
        best_i, best_score = -1, 0
        for index, para in enumerate(remaining):
            overlap = len(tokens & set(_normalize(para).split()))
            if overlap > best_score:
                best_score = overlap
                best_i = index
        if best_score > 0 and best_i >= 0:
            assigned[label] = remaining.pop(best_i)

    empties = [label for label in labels if not assigned[label]]
    for label, para in zip(empties, remaining):
        assigned[label] = para
    leftover = remaining[len(empties) :]
    if leftover:
        assigned["_unassigned"] = "\n\n".join(leftover)
    return assigned


def _load_template_tex(template: TemplateRecord, source: SourceRecord) -> str:
    if template.tex_path and template.tex_path.is_file():
        return template.tex_path.read_text(encoding="utf-8")

    settings = template.settings or {}
    return build_stub_tex(
        source,
        density=settings.get("density", "more_full"),
        text_size=settings.get("text_size", "medium"),
        include_diagrams=bool(settings.get("include_diagrams", True)),
        include_code=bool(settings.get("include_code", True)),
    )


def _paragraphs(text: str) -> list[str]:
    chunks = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if len(chunks) >= 2:
        return chunks
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return [text.strip()] if text.strip() else []
    return lines


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _clean_label(raw: str) -> str:
    label = re.sub(r"\\[a-zA-Z]+\{([^}]*)\}", r"\1", raw)
    label = re.sub(r"\\[a-zA-Z]+", "", label)
    return re.sub(r"\s+", " ", label).strip(" :")


def _line_has_label(line: str, label: str) -> bool:
    if label in line:
        return True
    return _normalize(label) in _normalize(line) and len(_normalize(label)) >= 4


def _student_block(text: str) -> list[str]:
    escaped = _tex_escape(text)
    escaped = escaped.replace("\n", r" \\ " + "\n")
    return [
        r"\par\vspace{0.35em}",
        r"{\color{studentink}",
        escaped,
        r"}",
        r"\vspace{0.55em}",
    ]


def _insert_before_end(lines: list[str], extra: list[str]) -> list[str]:
    for index in range(len(lines) - 1, -1, -1):
        if r"\end{document}" in lines[index]:
            return lines[:index] + extra + lines[index:]
    return lines + extra
