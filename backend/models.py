"""Pydantic request and response models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Density = Literal["more_full", "less_full"]
TextSize = Literal["small", "medium", "large"]
ExtractMethod = Literal["pymupdf", "tesseract"]
NotesMapper = Literal["heuristic", "nemotron"]


class PageExtractInfo(BaseModel):
    page_number: int
    method: ExtractMethod
    char_count: int


class IngestResponse(BaseModel):
    id: str
    filename: str
    page_count: int
    file_url: str
    pages: list[PageExtractInfo] = Field(default_factory=list)


class GenerateRequest(BaseModel):
    source_id: str
    density: Density = "more_full"
    text_size: TextSize = "medium"
    include_diagrams: bool = True
    include_code: bool = True


class GenerateResponse(BaseModel):
    template_id: str
    pdf_url: str
    page_count: int = 0
    stub: bool = Field(
        default=True,
        description="True while generation is the local stub (no Nemotron call).",
    )


class NotesUploadResponse(BaseModel):
    template_id: str
    filled_template_id: str
    pdf_url: str
    mapper: NotesMapper
    ocr_pages: int
    page_count: int = 0
    stub: bool = Field(
        default=True,
        description="True when slot mapping used the heuristic (no Nemotron call).",
    )


WorkspaceKind = Literal["source", "template", "filled"]


class WorkspaceDocumentInfo(BaseModel):
    kind: WorkspaceKind
    id: str
    page_count: int


class WorkspaceStrokePoint(BaseModel):
    x: float = Field(ge=-0.05, le=1.05)
    y: float = Field(ge=-0.05, le=1.05)


class WorkspaceStroke(BaseModel):
    points: list[WorkspaceStrokePoint] = Field(min_length=1, max_length=4000)
    color: str = "#111111"
    width: float = Field(default=0.008, gt=0, le=0.25)
    tool: Literal["pen", "highlighter", "eraser"] = "pen"
    opacity: float = Field(default=1.0, ge=0, le=1)


class WorkspaceTextRun(BaseModel):
    text: str = Field(max_length=4000)
    bold: bool = False
    italic: bool = False


class WorkspaceTextBox(BaseModel):
    x: float = Field(ge=-0.05, le=1.05)
    y: float = Field(ge=-0.05, le=1.05)
    width: float = Field(default=0.4, gt=0, le=1.2)
    height: float = Field(default=0.08, gt=0, le=1.2)
    text: str = Field(max_length=4000)
    font_size: float = Field(default=0.022, gt=0, le=0.2)
    color: str = "#111111"
    bold: bool = False
    italic: bool = False
    runs: list[WorkspaceTextRun] = Field(default_factory=list, max_length=500)


class WorkspacePageExport(BaseModel):
    page: int = Field(ge=1)
    strokes: list[WorkspaceStroke] = Field(default_factory=list)
    texts: list[WorkspaceTextBox] = Field(default_factory=list)


class WorkspaceExportRequest(BaseModel):
    kind: WorkspaceKind
    id: str
    pages: list[WorkspacePageExport] = Field(default_factory=list)


class WorkspaceExportResponse(BaseModel):
    export_id: str
    pdf_url: str
    page_count: int
