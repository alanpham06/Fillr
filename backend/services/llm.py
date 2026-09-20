"""Nemotron (self-hosted vLLM) client for turning lecture text into a note-sheet
spec.

The server is OpenAI-compatible, so we use the openai SDK pointed at
NVIDIA_BASE_URL. Nemotron does the thinking and returns a JSON description of the
sheet (title, sections, typed blocks); services.latex_render turns that JSON into
compile-ready LaTeX. Asking the model for JSON rather than raw LaTeX removes an
entire class of syntax failures a small model hits when authoring LaTeX directly.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache

from openai import OpenAI

from config import (
    LLM_SOURCE_CHAR_BUDGET,
    LLM_TIMEOUT_SECONDS,
    NVIDIA_API_KEY,
    NVIDIA_BASE_URL,
    NVIDIA_MODEL,
    SYSTEM_PROMPTS_DIR,
)
from models import Density, TextSize
from services.extractor import PageText

SYSTEM_PROMPT_PATH = SYSTEM_PROMPTS_DIR / "note_template_json.txt"

# Marker in the prompt template that separates the instructions from the
# {{source_text}} payload. Everything before it is the system message.
_SOURCE_PLACEHOLDER = "{{source_text}}"

_FENCE_OPEN_RE = re.compile(r"^```[a-zA-Z0-9]*\s*\n?")
_FENCE_CLOSE_RE = re.compile(r"\n?```\s*$")


class LLMError(RuntimeError):
    """Raised when the model call or its output is unusable."""


def is_configured() -> bool:
    """True when we have enough to attempt a call (an API key is set)."""
    return bool(NVIDIA_API_KEY)


@lru_cache(maxsize=1)
def _client() -> OpenAI:
    return OpenAI(
        base_url=NVIDIA_BASE_URL,
        api_key=NVIDIA_API_KEY or "not-set",
        timeout=LLM_TIMEOUT_SECONDS,
    )


@lru_cache(maxsize=1)
def _prompt_template() -> str:
    return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")


def _source_text(pages: list[PageText]) -> str:
    blocks: list[str] = []
    for page in pages:
        text = page.text.strip()
        if not text:
            continue
        blocks.append(f"--- Page {page.page_number} ---\n{text}")
    joined = "\n\n".join(blocks)
    if len(joined) > LLM_SOURCE_CHAR_BUDGET:
        joined = (
            joined[:LLM_SOURCE_CHAR_BUDGET].rstrip()
            + "\n\n[Source truncated to fit the model context window.]"
        )
    return joined


def _build_messages(
    pages: list[PageText],
    *,
    density: Density,
    text_size: TextSize,
    include_diagrams: bool,
    include_code: bool,
) -> list[dict[str, str]]:
    filled = (
        _prompt_template()
        .replace("{{density}}", density)
        .replace("{{text_size}}", text_size)
        .replace("{{include_diagrams}}", "true" if include_diagrams else "false")
        .replace("{{include_code}}", "true" if include_code else "false")
    )

    # Split instructions (system) from the source payload (user). The template
    # ends with a "SOURCE TEXT\n{{source_text}}" section.
    instructions, _, _ = filled.partition(_SOURCE_PLACEHOLDER)
    system_msg = instructions.strip()
    user_msg = (
        "Here is the extracted lecture source text. Return the JSON note-sheet "
        "spec now, following every rule above.\n\n"
        + (_source_text(pages) or "[No extractable text was found in the source.]")
    )
    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]


def _repair_truncated_json(text: str) -> str | None:
    """Best-effort repair of JSON cut off mid-structure (the model ran past
    max_tokens). Walk the text tracking the bracket stack, cut at the last
    completed element, and close the still-open brackets in the right order."""
    stack: list[str] = []
    in_str = esc = False
    safe_idx = -1
    safe_stack: list[str] = []
    for i, ch in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append(ch)
        elif ch in "}]":
            if stack:
                stack.pop()
            safe_idx = i
            safe_stack = list(stack)
    if safe_idx == -1:
        return None
    closers = "".join("}" if b == "{" else "]" for b in reversed(safe_stack))
    return text[: safe_idx + 1] + closers


def _extract_json(content: str) -> dict:
    """Parse the model reply into a dict, tolerating fences, surrounding prose,
    and truncation from hitting the token limit."""
    text = content.strip()
    text = _FENCE_OPEN_RE.sub("", text)
    text = _FENCE_CLOSE_RE.sub("", text).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1:
        raise LLMError("Model output contained no JSON object.")
    snippet = text[start : end + 1] if end > start else text[start:]

    try:
        data = json.loads(snippet)
    except json.JSONDecodeError:
        repaired = _repair_truncated_json(text[start:])
        if repaired is None:
            raise LLMError("Could not parse or repair model JSON.") from None
        try:
            data = json.loads(repaired)
        except json.JSONDecodeError as exc:
            raise LLMError(f"Could not parse model JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise LLMError("Model JSON was not an object.")
    return data


def generate_template_spec(
    pages: list[PageText],
    *,
    density: Density,
    text_size: TextSize,
    include_diagrams: bool,
    include_code: bool,
) -> dict:
    """Call Nemotron and return the parsed note-sheet spec dict.

    Raises LLMError on transport failure or when the reply is not usable JSON.
    """
    if not is_configured():
        raise LLMError("NVIDIA_API_KEY is not set; cannot call the model.")

    messages = _build_messages(
        pages,
        density=density,
        text_size=text_size,
        include_diagrams=include_diagrams,
        include_code=include_code,
    )

    try:
        completion = _client().chat.completions.create(
            model=NVIDIA_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=6144,
            response_format={"type": "json_object"},
            # Mild penalty to discourage the model looping out endless sections;
            # kept low so it does not fight the repeated JSON keys it must emit.
            presence_penalty=0.2,
            # vLLM/Nemotron-specific: skip the reasoning trace for speed.
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
    except Exception as exc:  # openai raises many subclasses; treat all as fatal
        raise LLMError(f"Model request failed: {exc}") from exc

    if not completion.choices:
        raise LLMError("Model returned no choices.")

    spec = _extract_json(completion.choices[0].message.content or "")
    sections = spec.get("sections")
    if not isinstance(sections, list) or not sections:
        raise LLMError("Model JSON had no sections.")
    return spec
