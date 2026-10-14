"""
SETTINGS: everything the backend reads from the environment, in one place.

Import this module first (main.py and transcribe.py both do). It:
1. Loads the project's root `.env` file (HF_TOKEN, WhisperX settings, ...).
2. Sets the environment flags that must exist *before* pyannote or Hugging
   Face code is imported: telemetry off and certificates for HTTPS.
3. Works out where data lives and makes sure the folders exist.

Changing a value: edit `.env` (copy `.env.example` if you don't have one), then
restart the server.
"""

import os
import shutil
from pathlib import Path

import certifi
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

# Values already set in the shell win over the .env file.
load_dotenv(ROOT_DIR / ".env")

# pyannote sends usage telemetry unless this is 0. Must be set before it is imported.
os.environ.setdefault("PYANNOTE_METRICS_ENABLED", "0")

# python.org's Python on macOS doesn't trust any HTTPS certificates until its
# "Install Certificates" step is run. Point it at certifi's bundle instead, so
# model downloads (when HF_HUB_OFFLINE=0) don't fail with CERTIFICATE_VERIFY_FAILED.
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

# --- WhisperX ---
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_LANGUAGE = "en"  # Fixed: auto-detect misfires on Pidgin/English code-switching.
WHISPER_BATCH_SIZE = int(os.getenv("WHISPER_BATCH_SIZE", "8"))

# Only needed to download the pyannote model the first time; offline runs use the cache.
HF_TOKEN = os.getenv("HF_TOKEN") or None

# --- Summaries (Purple Maia's OpenAI-compatible model server; see summarize.py) ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "lcpp-qwen3.6-27b-q4-ud-kxl-262k")
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "4000"))
LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "300"))

# --- Uploads ---
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "200"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

# --- Web testing ---
# Browsers only let a web page call another address (this server) if the server
# lists the page's address here (CORS). The Expo web build runs at
# localhost:8081. The phone app (Expo Go) doesn't need this. Comma-separated.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:8081").split(",") if o.strip()]

# --- Data folders (gitignored) ---
# DATA_DIR is relative to backend/, so the default "../data" is the repo's data/ folder.
DATA_DIR = (BACKEND_DIR / os.getenv("DATA_DIR", "../data")).resolve()
AUDIO_DIR = DATA_DIR / "audio"
SESSIONS_DIR = DATA_DIR / "sessions"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# ffmpeg converts every upload before transcription; the server can't work without it.
FFMPEG = shutil.which("ffmpeg")
