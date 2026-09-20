"""Shared restrained lecture-handout colors for generated LaTeX."""

from __future__ import annotations

COLOR_PACKAGES = [
    r"\usepackage{xcolor}",
    r"\usepackage{framed}",
    r"\usepackage{needspace}",
]

COLOR_DEFS = [
    r"\definecolor{ink}{HTML}{1F1B16}",
    r"\definecolor{slotdef}{HTML}{1F4D4A}",
    r"\definecolor{slotdraw}{HTML}{8A6A2F}",
    r"\definecolor{studentink}{HTML}{1A5F7A}",
    r"\color{ink}",
    r"\newcommand{\deflabel}[1]{\noindent\textcolor{slotdef}{\textbf{#1}}}",
    r"\newcommand{\drawlabel}[1]{\noindent\textcolor{slotdraw}{\textbf{#1}}}",
]

LSTSET = (
    r"\lstset{basicstyle=\ttfamily\small,breaklines=true,frame=single,"
    r"backgroundcolor=\color{slotdraw!6},rulecolor=\color{slotdraw}}"
)

# Last-resort PyMuPDF colors (0-1 RGB).
INK_RGB = (0.12, 0.11, 0.09)
SLOTDEF_RGB = (0.12, 0.30, 0.29)
SLOTDRAW_RGB = (0.54, 0.42, 0.18)
STUDENT_RGB = (0.10, 0.37, 0.48)


def preamble_lines() -> list[str]:
    return [*COLOR_PACKAGES, *COLOR_DEFS, LSTSET]


def ensure_color_preamble(tex: str) -> str:
    """Add color defs to an older .tex that was generated without them."""
    extras: list[str] = []
    if r"\usepackage{xcolor}" not in tex:
        extras.append(r"\usepackage{xcolor}")
    if r"\usepackage{needspace}" not in tex:
        extras.append(r"\usepackage{needspace}")
    if r"\definecolor{studentink}" not in tex:
        extras.extend(COLOR_DEFS)
    if not extras:
        return tex

    block = "\n".join(extras) + "\n"
    marker = r"\begin{document}"
    if marker in tex:
        return tex.replace(marker, block + marker, 1)
    return block + tex
