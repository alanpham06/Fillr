"""Pydantic request and response models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Density = Literal["more_full", "less_full"]
TextSize = Literal["small", "medium", "large"]


class IngestResponse(BaseModel):
    id: str
    filename: str
    page_count: int
    file_url: str


class GenerateRequest(BaseModel):
    source_id: str
    density: Density = "more_full"
    text_size: TextSize = "medium"
    include_diagrams: bool = True
    include_code: bool = True


class GenerateResponse(BaseModel):
    template_id: str
    pdf_url: str
    stub: bool = Field(
        default=True,
        description="True while generation is the local stub (no Nemotron call).",
    )
