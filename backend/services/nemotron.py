"""Nemotron client for aligning OCR'd notes onto template slots (text only).

Points at the self-hosted vLLM server (config.NVIDIA_BASE_URL), same as the
generate path. Any failure returns None so the caller falls back to the local
heuristic — the notes feature keeps working even if the model is unreachable."""

from __future__ import annotations

import json
import re
from pathlib import Path

from config import (
    LLM_TIMEOUT_SECONDS,
    NVIDIA_API_KEY,
    NVIDIA_BASE_URL,
    NVIDIA_MODEL,
    SYSTEM_PROMPTS_DIR,
)

_ALIGN_PROMPT = SYSTEM_PROMPTS_DIR / "notes_align.txt"
_MAX_OCR_CHARS = 12000


def map_ocr_to_slots(labels: list[str], ocr_text: str) -> dict[str, str] | None:
    """Return {label: student_text} or None if no key / the call fails."""
    if not NVIDIA_API_KEY or not labels:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    system = (
        _ALIGN_PROMPT.read_text(encoding="utf-8")
        if _ALIGN_PROMPT.is_file()
        else "Map OCR text onto the given labels. JSON only."
    )
    user = (
        "SLOT LABELS:\n"
        + "\n".join(f"- {label}" for label in labels)
        + "\n\nOCR TEXT:\n"
        + ocr_text[:_MAX_OCR_CHARS]
    )

    try:
        client = OpenAI(
            base_url=NVIDIA_BASE_URL,
            api_key=NVIDIA_API_KEY,
            timeout=LLM_TIMEOUT_SECONDS,
        )
        response = client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.1,
            max_tokens=4096,
            response_format={"type": "json_object"},
            # vLLM/Nemotron-specific: skip the reasoning trace for speed.
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
        content = (response.choices[0].message.content or "").strip()
    except Exception:
        return None

    parsed = _parse_json(content)
    if parsed is None:
        return None

    assigned: dict[str, str] = {}
    known = {label: label for label in labels}
    for item in parsed.get("slots") or []:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        text = str(item.get("text") or "").strip()
        if label in known and text:
            assigned[label] = text
    leftover = str(parsed.get("unassigned") or "").strip()
    if leftover:
        assigned["_unassigned"] = leftover
    return assigned or None


def _parse_json(content: str) -> dict | None:
    cleaned = content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None
