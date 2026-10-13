# Session Assistant

A self-hosted tool that records counseling and meeting sessions and transcribes them with speaker labels. Everything runs locally: audio and transcripts never leave this Mac and phone.

## Layout

```
backend/    FastAPI app + WhisperX (transcribe.py)
mobile/     Expo (React Native) app, run in Expo Go
data/       gitignored: audio/, sessions/
.env        gitignored; copy from .env.example
```

## Prerequisites

- Node 18+
- Python 3.10–3.13 (WhisperX 3.8.6 doesn't support 3.14). This Mac uses the python.org Python 3.12 at `/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12`
- ffmpeg (`brew install ffmpeg`)
- A Hugging Face read token, with the `pyannote/speaker-diarization-community-1` terms accepted
- Expo Go on your phone, matching the app's Expo SDK version (57)

## Setup

```bash
cp .env.example .env   # then fill in HF_TOKEN
```

The first run downloads about 900 MB of models. Set `HF_HUB_OFFLINE=0` in `.env` for that run, then set it back to `1` so the server never contacts Hugging Face.

## Run the backend

```bash
cd backend
python3.12 -m venv .venv          # first time only
source .venv/bin/activate         # every new terminal
pip install -r requirements.txt   # first time only
uvicorn main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` lets the phone reach it over Wi-Fi. Use only a trusted network. API docs: http://localhost:8000/docs

Models load in the background at startup (about 15 s). `GET /api/health` shows `"models_loaded": true` when they're ready.

**Test the whole flow** (in a second terminal, with the server running and the venv active). It uses consented or synthetic audio only and never prints transcript text:

```bash
cd backend && python smoke_test.py ../data/audio/test.wav
```

| File | Job |
| --- | --- |
| `main.py` | The API endpoints and the background job queue (one job at a time) |
| `transcribe.py` | The only file that uses WhisperX: convert → transcribe → align → identify speakers |
| `sessions.py` | Reads and writes `data/sessions/<id>.json` and `<id>.transcript.json` |
| `config.py` | Loads `.env` and sets the folder paths |
| `smoke_test.py` | End-to-end check against a running server |

## Run the mobile app

How the app is put together (screens, API layer, demo mode, config files): see [mobile/README.md](mobile/README.md).

1. Find the Mac's local IP: `ipconfig getifaddr en0`
2. Create `mobile/.env` (gitignored) with `EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8000`
3. Start the app, then scan the QR code with Expo Go (phone and Mac on the same Wi-Fi):

```bash
cd mobile
npm install      # first time only
npx expo start
```

Restart `npx expo start` after changing `mobile/.env`.

**Demo mode:** without `EXPO_PUBLIC_API_URL`, the app uses a simulated backend (`mobile/src/lib/mock-api.ts`). Recording and file picking are real, but nothing is uploaded: status steps through the stages and a sample transcript comes back. Pick a file with "fail" in its name to see the failure screen.

## Privacy rules

- No cloud APIs. Audio and transcripts stay on this Mac and phone.
- Never commit audio, transcripts, session data or tokens.
- Never log transcript text.
- Participants are stored by ID (e.g. `youth-001`); names are display-only.
