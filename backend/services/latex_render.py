"""Deterministically render a template spec (from Nemotron) into compile-ready
LaTeX.

The model decides *what* the note sheet contains (headings, labels, block types,
blank sizes) and returns JSON; this module turns that JSON into LaTeX. Because
the rendering is pure Python with escaped text and a fixed set of constructs, it
cannot produce a LaTeX syntax error the way a model authoring raw LaTeX does.
"""

from __future__ import annotations

import re
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
_PICTURE_BOX = "0.30"

# Writing gap per numbered step (fraction of text height). Small by default so a
# few short bullets stay compact; grow only when each step is a real chunk.
_STEP_GAP: dict[str, float] = {
    "tiny": 0.035,
    "short": 0.06,
    "medium": 0.10,
    "long": 0.16,
}

_MAX_SECTIONS = 12
_MAX_BLOCKS_PER_SECTION = 12


# Inline spans inside a label/heading: $...$ is LaTeX math (passed through), and
# `...` is inline code (typeset monospace via \texttt).
_INLINE_SPAN = re.compile(r"(\$[^$]*\$|`[^`]*`)")

_TEX_SPECIALS = {
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

# A code scaffold line is allowed only when it is a construct HEADER (a def,
# loop, branch, or class opener) -- never a body statement that would give the
# answer away. Headers either open a Python block (end with ":") or a C/Java
# block (end with "{"), or start with a known header keyword.
_HEADER_KEYWORDS = ("def ", "for ", "while ", "if ", "elif ", "else", "class ",
                    "switch ", "case ", "do ", "func ", "function ")


def _is_scaffold_header(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.endswith((":", "{")):
        return True
    return stripped.startswith(_HEADER_KEYWORDS)


def _escape_specials(s: str) -> str:
    """Escape LaTeX special characters, nothing else."""
    return "".join(_TEX_SPECIALS.get(char, char) for char in str(s))


def _tex_escape(text: str) -> str:
    """Escape plain prose for LaTeX. Also removes em/en dashes and collapses
    hyphen runs so LaTeX's `--`/`---` ligatures never render a dash the user
    does not want."""
    s = str(text).replace("—", "-").replace("–", "-")
    s = re.sub(r"-{2,}", "-", s)  # kill --- (em) and -- (en) ligatures
    return _escape_specials(s)


# Auto-detect obvious code in prose the model forgot to backtick, so it still
# renders in \texttt: function calls name(...), indexing name[...], expressions
# with a code operator (cards == [], n != 0, x += 1, a -> b), and bare empty
# collections ([] or {}). Kept to high-signal code tokens to avoid catching
# ordinary prose.
_AUTO_CODE = re.compile(
    r"[A-Za-z_]\w*\([^()]*\)"                                        # name(...)
    r"|[A-Za-z_]\w*\[[^\[\]]*\]"                                     # name[...]
    r"|[\w.\)\]'\"]+\s*(?:==|!=|<=|>=|\+=|-=|->|=>|//)\s*"           # expr <op>
    r"(?:\[[^\[\]]*\]|\{[^{}]*\}|\([^()]*\)|[\w.'\"+\-])+"           #   operand(s)
    r"|\[\s*\]|\{\s*\}"                                              # [] or {}
)


def _escape_prose(seg: str) -> str:
    """Escape prose, but typeset embedded function-call/index tokens as code."""
    out: list[str] = []
    last = 0
    for m in _AUTO_CODE.finditer(seg):
        out.append(_tex_escape(seg[last : m.start()]))
        out.append(r"\texttt{" + _escape_specials(m.group(0)) + "}")
        last = m.end()
    out.append(_tex_escape(seg[last:]))
    return "".join(out)


def _escape_text(text: str) -> str:
    """Escape a label/heading while letting inline spans survive:
    `$...$` passes through as LaTeX math; `` `...` `` becomes monospace code via
    \\texttt; obvious code tokens in prose are auto-typeset as code; everything
    else is escaped as plain prose (dashes stripped)."""
    s = str(text)
    parts: list[str] = []
    last = 0
    for m in _INLINE_SPAN.finditer(s):
        parts.append(_escape_prose(s[last : m.start()]))
        tok = m.group(0)
        if tok.startswith("$"):
            parts.append(tok)  # verbatim math span, incl. the $ delimiters
        else:  # `code`
            parts.append(r"\texttt{" + _escape_specials(tok[1:-1]) + "}")
        last = m.end()
    parts.append(_escape_prose(s[last:]))
    return "".join(parts)


# A cue label states the idea and stops; the answer belongs in the blank. When
# the model still appends the answer after a colon ("Core idea: X is ..."), trim
# it back to the cue. Kept conservative: only for slot labels, only when the
# tail is long and the label is not a question the student must answer.
def _cue_only(label: str) -> str:
    if "?" in label or ":" not in label:
        return label
    head, _, tail = label.rpartition(":")
    head = head.strip()
    tail = tail.strip()
    if head and len(tail.split()) >= 4:
        return head + ":"
    return label


_SETUP_OK_PREFIXES = ("suppose", "assume", "let ", "given ", "e.g", "example", "for example")
_SETUP_CODE_CHARS = set("=()[]{}<>/\\$`|;")


def _is_scaffold_setup(setup: str) -> bool:
    """A slot's setup is a tiny scaffold to annotate (a premise or a code-like
    snippet), never the answer in prose. Keep it only when it reads like one:
    a "Suppose ..."-style premise, or something with code/math punctuation. A
    plain prose sentence is the model leaking the answer -- drop it."""
    s = setup.strip()
    if not s:
        return False
    low = s.lower()
    if low.startswith(_SETUP_OK_PREFIXES):
        return True
    if any(ch in _SETUP_CODE_CHARS for ch in s):
        return True
    return len(s.split()) <= 4  # a short fragment is fine; a sentence is not


def _norm_code(s: str) -> str:
    return re.sub(r"\s+", "", str(s)).strip("`").lower()


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
    raw = str(block.get("label") or block.get("text") or "").strip()
    label = _escape_text(_cue_only(raw)).strip()
    if not label:
        return
    h = _height(block.get("size"))
    out.append(rf"\Needspace{{{h}\textheight}}")
    out.append(rf"\deflabel{{{label}}}")
    raw_setup = str(block.get("setup") or "").strip()
    setup = _escape_text(raw_setup).strip() if _is_scaffold_setup(raw_setup) else ""
    if setup:
        # A tiny printed scaffold under the label (never the answer).
        out.append(rf"\par\nopagebreak{{\small {setup}}}")
    out.append(rf"\vspace{{{h}\textheight}}")
    out.append("")


def _render_steps(block: dict, out: list[str]) -> None:
    """A labeled, numbered scaffold the student fills in step by step: the label
    poses the task/problem, then 1., 2., 3. each get a blank to write on. Use for
    ordered procedures and algorithms. The gap per step scales with "size" so a
    list of short bullets does not waste half a page."""
    label = _escape_text(block.get("label") or block.get("text") or "").strip()
    try:
        count = int(block.get("count") or 3)
    except (TypeError, ValueError):
        count = 3
    count = max(2, min(count, 6))
    per_step = _STEP_GAP.get(str(block.get("size") or "short").strip().lower(), _STEP_GAP["short"])
    out.append(rf"\Needspace{{{min(0.9, per_step * count + 0.06):.2f}\textheight}}")
    if label:
        out.append(rf"\deflabel{{{label}}}\par\nopagebreak")
    for i in range(1, count + 1):
        out.append(rf"\noindent {i}.")
        out.append(rf"\par\vspace{{{per_step}\textheight}}")
    out.append("")


def _render_picture(block: dict, out: list[str]) -> None:
    # No "Picture:" prefix -- the label alone captions the sketch box.
    caption = _escape_text(block.get("label") or "Sketch").strip()
    out.append(rf"\Needspace{{0.50\textheight}}")
    out.append(rf"\drawlabel{{{caption}}}")
    out.append(
        r"\begin{framed}\begin{minipage}[t][" + _PICTURE_BOX + r"\textheight]{\linewidth}"
        r"\end{minipage}\end{framed}"
    )
    out.append("")


def _render_code(block: dict, out: list[str]) -> None:
    # Caption is escaped LaTeX (typeset as text); scaffold is verbatim listing
    # content (the def/signature or loop guard the student writes below).
    label = _escape_text(block.get("label") or "").strip()
    scaffold = str(block.get("setup") or block.get("scaffold") or "")
    # Only ONE guiding line belongs here: a function's def/signature, or a
    # loop's first line. Keep just the first non-empty line and drop the rest so
    # the box never leaks the body the student is meant to write in lecture.
    first_line = next(
        (
            line.rstrip()
            for line in scaffold.splitlines()
            if line.strip() and r"\end{lstlisting}" not in line
        ),
        "",
    )
    # Guardrail: only a construct header may be printed. A body statement (an
    # assignment, a return, a call) gives the answer away, so drop it and leave
    # the box empty for the student.
    if first_line and not _is_scaffold_header(first_line):
        first_line = ""
    # If the caption just repeats the scaffold line (model used the signature as
    # the caption), drop the caption so the line is not printed twice.
    caption = block.get("label") or ""
    if first_line and _norm_code(caption) == _norm_code(first_line):
        label = ""
    out.append(r"\Needspace{0.26\textheight}")
    out.append(rf"\codelabel{{{label or 'Code'}}}\par\nopagebreak")
    out.append(r"\begin{lstlisting}")
    if first_line:
        out.append(first_line)
    # Blank lines inside the box = room to hand-write the body in lecture.
    out.extend(["", "", "", "", "", ""])
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
    title = _escape_text(spec.get("title") or "Lecture note template").strip()
    sections = spec.get("sections")
    if not isinstance(sections, list):
        sections = []

    body: list[str] = [
        r"\begin{center}",
        rf"{{\Large\bfseries {title}}}",
        r"\end{center}",
        r"\vspace{1em}",
        "",
    ]

    trimmed = [s for s in sections[:_MAX_SECTIONS] if isinstance(s, dict)]

    def _code_key(block: dict) -> str:
        return _norm_code(
            block.get("setup") or block.get("scaffold") or block.get("label") or ""
        )

    # When the same code block appears in two sections (the model sometimes
    # previews a function early, then shows it again where the lecture actually
    # covers it), keep only the LAST occurrence -- that is the in-order one.
    last_code_pos: dict[str, tuple[int, int]] = {}
    for si, section in enumerate(trimmed):
        blocks = section.get("blocks")
        if not isinstance(blocks, list):
            continue
        for bi, block in enumerate(blocks[:_MAX_BLOCKS_PER_SECTION]):
            if isinstance(block, dict) and str(block.get("type", "")).strip().lower() == "code":
                key = _code_key(block)
                if key:
                    last_code_pos[key] = (si, bi)

    rendered_blocks = 0
    for si, section in enumerate(trimmed):
        # Render a section's blocks into a buffer first, so a heading whose only
        # block was dropped (e.g. a de-duplicated code block) is omitted too.
        section_body: list[str] = []
        blocks = section.get("blocks")
        if isinstance(blocks, list):
            for bi, block in enumerate(blocks[:_MAX_BLOCKS_PER_SECTION]):
                if not isinstance(block, dict):
                    continue
                btype = str(block.get("type", "slot")).strip().lower()
                if btype == "picture":
                    if include_diagrams:
                        _render_picture(block, section_body)
                elif btype == "code":
                    if include_code:
                        key = _code_key(block)
                        if key and last_code_pos.get(key) != (si, bi):
                            continue  # not the last occurrence; drop it
                        _render_code(block, section_body)
                elif btype == "steps":
                    _render_steps(block, section_body)
                else:  # slot (default) and any unknown label-style block
                    _render_slot(block, section_body)
        if not section_body:
            continue
        heading = _escape_text(section.get("heading") or "").strip()
        if heading:
            body.append(rf"\topicheading{{{heading}}}")
        body.extend(section_body)
        rendered_blocks += 1

    if rendered_blocks == 0:
        # Nothing usable came back; let the caller fall back to the stub.
        raise ValueError("Template spec produced no renderable blocks.")

    return "\n".join(
        [*_preamble(text_size), r"\begin{document}", "", *body, "", r"\end{document}", ""]
    )
