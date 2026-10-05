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
- Python 3.11 (`brew install python@3.11`)
- ffmpeg (`brew install ffmpeg`)
- A Hugging Face read token, with the `pyannote/speaker-diarization-community-1` terms accepted
- Expo Go on your phone, matching the app's Expo SDK version (57)

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
uvicorn main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` lets the phone reach it over Wi-Fi. Use only a trusted network. API docs: http://localhost:8000/docs

## Run the mobile app

1. Find the Mac's local IP: `ipconfig getifaddr en0`
2. Create `mobile/.env` (gitignored) with `EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8000`
3. Start the app, then scan the QR code with Expo Go (phone and Mac on the same Wi-Fi):

```bash
cd mobile
npm install      # first time only
npx expo start
```

Restart `npx expo start` after changing `mobile/.env`.

## Privacy rules

- No cloud APIs. Audio and transcripts stay on this Mac and phone.
- Never commit audio, transcripts, session data or tokens.
- Never log transcript text.
- Participants are stored by ID (e.g. `youth-001`); names are display-only.
