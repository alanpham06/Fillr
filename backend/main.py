"""Minimal FastAPI app for lecture-template ingest and stub generation."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGIN_REGEX, CORS_ORIGINS, ensure_data_dirs
from routers import ingest, templates, workspace

ensure_data_dirs()

app = FastAPI(
    title="Lecture Template API",
    description="Upload lecture slides, generate fill-in note templates, and merge OCR'd completed notes.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(ingest.router)
app.include_router(templates.router)
app.include_router(workspace.router)


@app.get("/")
@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}
