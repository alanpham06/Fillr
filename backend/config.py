"""Runtime paths and env-backed settings. Secrets stay in the environment."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_ROOT.parent

# Load env before reading it. .env.local (gitignored, holds real secrets) wins;
# .env is an optional fallback. load_dotenv never overrides vars already exported.
load_dotenv(REPO_ROOT / ".env.local")
load_dotenv(REPO_ROOT / ".env")
DATA_DIR = BACKEND_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
GENERATED_DIR = DATA_DIR / "generated"
TEX_DIR = DATA_DIR / "tex"
PAGES_DIR = DATA_DIR / "pages"
OUTPUT_DIR = BACKEND_ROOT / "output"
SYSTEM_PROMPTS_DIR = BACKEND_ROOT / "system_prompts"

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
# Self-hosted vLLM on Brev (OpenAI-compatible). Reach it via the local
# port-forward: `brev port-forward nemotron -p 5000:5000`. Override with the
# tunnel URL when deploying. Served model name is "nemotron".
NVIDIA_BASE_URL = os.environ.get("NVIDIA_BASE_URL", "http://localhost:5000/v1")
NVIDIA_MODEL = os.environ.get("NVIDIA_MODEL", "nemotron")
# Cap source text sent to the model so prompt + reply fit the 32k context.
LLM_SOURCE_CHAR_BUDGET = int(os.environ.get("LLM_SOURCE_CHAR_BUDGET", "24000"))
LLM_TIMEOUT_SECONDS = float(os.environ.get("LLM_TIMEOUT_SECONDS", "180"))
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
