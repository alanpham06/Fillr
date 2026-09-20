"""Deterministically render a template spec (from Nemotron) into compile-ready
LaTeX.

The model decides *what* the note sheet contains (headings, labels, block types,
blank sizes) and returns JSON; this module turns that JSON into LaTeX. Because
the rendering is pure Python with escaped text and a fixed set of constructs, it
cannot produce a LaTeX syntax error the way a model authoring raw LaTeX does.
"""

from __future__ import annotations

from typing import Any

from models import Density, TextSize
from services.latex_style import COLOR_DEFS, COLOR_PACKAGES, LSTSET

# text_size -> (font size option, document class).
_DOC_CLASS_BY_SIZE: dict[str, tuple[str, str]] = {
    "small": ("11pt", "article"),
    "medium": ("12pt", "article"),
    "large": ("14pt", "extarticle"),
}

# Blank height by expected answer size (fraction of text height).
_SIZE_TO_HEIGHT: dict[str, str] = {
    "tiny": "0.08",
    "short": "0.14",
    "medium": "0.22",
    "long": "0.34",
}
_DEFAULT_SIZE = "short"
_PICTURE_BOX = "0.42"

_MAX_SECTIONS = 12
_MAX_BLOCKS_PER_SECTION = 12


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
    return "".join(replacements.get(char, char) for char in str(text))


def _height(size: Any) -> str:
    return _SIZE_TO_HEIGHT.get(str(size).strip().lower(), _SIZE_TO_HEIGHT[_DEFAULT_SIZE])


def _preamble(text_size: TextSize) -> list[str]:
    point, doc_class = _DOC_CLASS_BY_SIZE.get(text_size, _DOC_CLASS_BY_SIZE["medium"])
    return [
        rf"\documentclass[{point}]{{{doc_class}}}",
        r"\usepackage[margin=0.85in]{geometry}",
        r"\usepackage{enumitem}",
        r"\usepackage{listings}",
        r"\usepackage{amssymb}",
        *COLOR_PACKAGES,
        *COLOR_DEFS,
        LSTSET,
    ]


def _render_slot(block: dict, out: list[str]) -> None:
    label = _tex_escape(block.get("label") or block.get("text") or "").strip()
    if not label:
        return
    h = _height(block.get("size"))
    out.append(rf"\Needspace{{{h}\textheight}}")
    out.append(rf"\deflabel{{{label}}}")
    out.append(rf"\vspace{{{h}\textheight}}")
    out.append("")


def _render_picture(block: dict, out: list[str]) -> None:
    label = _tex_escape(block.get("label") or "").strip()
    caption = f"Picture: {label}" if label else "Picture:"
    out.append(rf"\Needspace{{0.50\textheight}}")
    out.append(rf"\drawlabel{{{caption}}}")
    out.append(
        r"\begin{framed}\begin{minipage}[t][" + _PICTURE_BOX + r"\textheight]{\linewidth}"
        r"\end{minipage}\end{framed}"
    )
    out.append("")


def _render_code(block: dict, out: list[str]) -> None:
    label = _tex_escape(block.get("label") or "").strip()
    out.append(r"\Needspace{0.18\textheight}")
    if label:
        out.append(rf"\deflabel{{{label}}}")
    out.append(r"\begin{lstlisting}")
    out.append("")
    out.append("")
    out.append("")
    out.append(r"\end{lstlisting}")
    out.append("")


def render_template(
    spec: dict,
    *,
    density: Density,
    text_size: TextSize,
    include_diagrams: bool,
    include_code: bool,
) -> str:
    """Render a validated-enough spec dict to a full LaTeX document.

    Defensive: unknown block types and malformed entries are skipped rather than
    raising, and picture/code blocks are dropped when their toggle is off.
    """
    title = _tex_escape(spec.get("title") or "Lecture note template").strip()
    sections = spec.get("sections")
    if not isinstance(sections, list):
        sections = []

    body: list[str] = [
        r"\begin{center}",
        rf"{{\Large\bfseries {title}}}\\[0.3em]",
        r"\textit{Fill-in template --- not completed notes and not an answer key.}",
        r"\end{center}",
        r"\vspace{1em}",
        "",
    ]

    rendered_blocks = 0
    for section in sections[:_MAX_SECTIONS]:
        if not isinstance(section, dict):
            continue
        heading = _tex_escape(section.get("heading") or "").strip()
        if heading:
            body.append(rf"\section*{{{heading}}}")
        blocks = section.get("blocks")
        if not isinstance(blocks, list):
            continue
        for block in blocks[:_MAX_BLOCKS_PER_SECTION]:
            if not isinstance(block, dict):
                continue
            btype = str(block.get("type", "slot")).strip().lower()
            if btype == "picture":
                if include_diagrams:
                    _render_picture(block, body)
                    rendered_blocks += 1
            elif btype == "code":
                if include_code:
                    _render_code(block, body)
                    rendered_blocks += 1
            else:  # slot (default) and any unknown label-style block
                _render_slot(block, body)
                rendered_blocks += 1

    if rendered_blocks == 0:
        # Nothing usable came back; let the caller fall back to the stub.
        raise ValueError("Template spec produced no renderable blocks.")

    body.extend(
        [
            r"\vspace{1.5em}",
            r"\begin{center}\textit{This sheet may not cover every topic from the "
            r"source slides.}\end{center}",
        ]
    )

    return "\n".join(
        [*_preamble(text_size), r"\begin{document}", "", *body, "", r"\end{document}", ""]
    )
