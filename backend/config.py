"""Runtime paths and env-backed settings. Secrets stay in the environment."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
DATA_DIR = BACKEND_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
GENERATED_DIR = DATA_DIR / "generated"
TEX_DIR = DATA_DIR / "tex"
OUTPUT_DIR = BACKEND_ROOT / "output"

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def ensure_data_dirs() -> None:
    for path in (UPLOAD_DIR, GENERATED_DIR, TEX_DIR):
        path.mkdir(parents=True, exist_ok=True)
