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
    # Code the student writes gets its own blue identity, distinct from the
    # green slot labels and brown sketch labels.
    r"\definecolor{codeink}{HTML}{0B3D91}",
    r"\definecolor{codeframe}{HTML}{3B6FB5}",
    r"\color{ink}",
    r"\newcommand{\deflabel}[1]{\noindent\textcolor{slotdef}{\textbf{#1}}}",
    r"\newcommand{\drawlabel}[1]{\noindent\textcolor{slotdraw}{\textbf{#1}}}",
    r"\newcommand{\codelabel}[1]{\noindent\textcolor{codeframe}{\textbf{\ttfamily #1}}}",
    # Topic heading: reserve room so a heading never orphans at the page
    # bottom (moves to the next page instead). Transitions read through a bold
    # colored heading and generous spacing -- no rule (the rule was disliked).
    r"\newcommand{\topicheading}[1]{\par\addvspace{1.6em}\Needspace{0.22\textheight}"
    r"\noindent{\color{slotdef}\large\bfseries #1}\par\nobreak\vspace{0.6em}\nobreak}",
]

# Code-writing box: monospace, blue ink, tinted blue frame — reads clearly as
# "write your code here" and stands apart from handwriting slots.
LSTSET = (
    r"\lstdefinestyle{codewrite}{basicstyle=\ttfamily\small\color{codeink},"
    r"breaklines=true,frame=single,framesep=6pt,xleftmargin=8pt,xrightmargin=4pt,"
    r"backgroundcolor=\color{codeframe!8},rulecolor=\color{codeframe},"
    # showlines=true keeps the trailing blank lines (writing room); without it
    # listings trims them and the box collapses to the scaffold line.
    r"showlines=true,aboveskip=0.5em,belowskip=0.6em}"
    "\n"
    r"\lstset{style=codewrite}"
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
