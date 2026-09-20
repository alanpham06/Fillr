"""Runtime paths and env-backed settings. Secrets stay in the environment."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
DATA_DIR = BACKEND_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
GENERATED_DIR = DATA_DIR / "generated"
TEX_DIR = DATA_DIR / "tex"
PAGES_DIR = DATA_DIR / "pages"
OUTPUT_DIR = BACKEND_ROOT / "output"
SYSTEM_PROMPTS_DIR = BACKEND_ROOT / "system_prompts"

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.environ.get(
    "NVIDIA_MODEL",
    "nvidia/llama-3.1-nemotron-70b-instruct",
)
DATABASE_URL = os.environ.get("DATABASE_URL", "")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]
# Expo Go (exp://), tunnels, and LAN origins. React Native fetch often omits Origin.
CORS_ORIGIN_REGEX = os.environ.get("CORS_ORIGIN_REGEX", r".*")


def ensure_data_dirs() -> None:
    for path in (UPLOAD_DIR, GENERATED_DIR, TEX_DIR, PAGES_DIR):
        path.mkdir(parents=True, exist_ok=True)
