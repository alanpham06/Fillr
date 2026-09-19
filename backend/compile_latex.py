"""Compile a .tex file to PDF with Tectonic (local Overleaf-style engine).

Tectonic is a single TeX engine. On first compile it downloads missing
packages automatically, similar to Overleaf.

Usage:
    conda activate steelhacks
    python compile_latex.py samples/note_template_preview.tex
    python compile_latex.py samples/note_template_preview.tex -o output/preview.pdf
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


class LatexCompileError(RuntimeError):
    pass


def find_tectonic() -> str:
    tectonic = shutil.which("tectonic")
    if tectonic:
        return tectonic
    raise LatexCompileError(
        "tectonic not found. Activate the steelhacks conda env, or install with:\n"
        "  conda install -n steelhacks -c conda-forge tectonic"
    )


def compile_tex(tex_path: Path, output_pdf: Path) -> Path:
    if not tex_path.is_file():
        raise FileNotFoundError(f"TeX file not found: {tex_path}")
    if tex_path.suffix.lower() != ".tex":
        raise ValueError(f"Expected a .tex file, got: {tex_path.suffix}")

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    work_dir = output_pdf.parent

    command = [
        find_tectonic(),
        "--outdir",
        str(work_dir),
        str(tex_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        details = (result.stderr or result.stdout).strip()
        raise LatexCompileError(f"Tectonic failed:\n{details}")

    produced = work_dir / f"{tex_path.stem}.pdf"
    if produced.resolve() != output_pdf.resolve():
        shutil.move(str(produced), str(output_pdf))
    if not output_pdf.is_file():
        raise LatexCompileError(f"Compile finished but PDF missing: {output_pdf}")
    return output_pdf


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compile LaTeX to PDF with Tectonic")
    parser.add_argument("tex", type=Path, help="Path to the .tex file")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Where to write the PDF (default: next to the .tex file)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    tex_path = args.tex.expanduser().resolve()
    output_pdf = (
        args.output.expanduser().resolve()
        if args.output
        else tex_path.with_suffix(".pdf")
    )

    try:
        written = compile_tex(tex_path, output_pdf)
    except (FileNotFoundError, ValueError, LatexCompileError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {written}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
