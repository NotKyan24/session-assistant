# Session Assistant

A self-hosted tool that records counseling and meeting sessions and transcribes them with speaker labels. Everything runs locally: audio and transcripts never leave this machine.

## Layout

```
backend/    FastAPI app + WhisperX (transcribe.py)
frontend/   React (Vite) app
data/       gitignored: audio/, sessions/
.env        gitignored; copy from .env.example
```

## Prerequisites

- Node 18+
- Python 3.11 (`brew install python@3.11`)
- ffmpeg (`brew install ffmpeg`)
- A Hugging Face read token, with the `pyannote/speaker-diarization-community-1` terms accepted

## Setup

```bash
cp .env.example .env   # then fill in HF_TOKEN
```

## Run the backend

```bash
cd backend
python3.11 -m venv .venv          # first time only
source .venv/bin/activate         # every new terminal
pip install -r requirements.txt   # first time only
uvicorn main:app --reload
```

API docs: http://localhost:8000/docs

## Run the frontend

```bash
cd frontend
npm install      # first time only
npm run dev
```

Open the app at `http://localhost:5173` (the mic only works on localhost or HTTPS). The Vite dev server proxies `/api` to the backend.

## Privacy rules

- No cloud APIs. Audio and transcripts stay on this machine.
- Never commit audio, transcripts, session data or tokens.
- Never log transcript text.
- Participants are stored by ID (e.g. `youth-001`); names are display-only.
