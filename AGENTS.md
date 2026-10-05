Session Assistant: a self-hosted tool that records counseling and meeting sessions, transcribes them with speaker labels, and (later) summarizes them. Users are staff at a youth-serving nonprofit, so privacy rules are strict.

## Stack

- `backend/`: Python 3.11 + FastAPI. WhisperX runs locally on an Apple M3 MacBook: CPU only, model `small`, compute_type `int8`, language `en`.
- `frontend/`: React (Vite, JavaScript). The Vite dev proxy sends `/api` to `http://localhost:8000`.
- `data/`: gitignored. `audio/` and `sessions/` (one JSON file per session, no database).

## Rules

- No cloud APIs. Audio and transcripts never leave this machine.
- Never commit audio, transcripts, session data or tokens. Keep them in the gitignored `data/` folder and `.env`.
- Never log transcript text. Logs carry stages and timings only.
- Participants are stored by ID (e.g. `youth-001`); names are display-only.
- Keep the WhisperX call behind one module (`backend/transcribe.py`) with a single function: audio file path in, segments with speaker/start/end/text out, so the engine can be swapped later.
- WhisperX's API changes between versions: read the installed version's README before writing diarization code; never guess.
- Show a short plan before writing code for each phase.
