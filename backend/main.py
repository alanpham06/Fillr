"""Minimal FastAPI app for lecture-template ingest and stub generation."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, ensure_data_dirs
from routers import ingest, templates

ensure_data_dirs()

app = FastAPI(
    title="Lecture Template API",
    description="Upload lecture slides and generate fill-in note templates.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(ingest.router)
app.include_router(templates.router)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}
