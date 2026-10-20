# Session Assistant

A self-hosted tool that records counseling and meeting sessions, transcribes them with speaker labels, and writes structured session notes. Audio and transcription stay on this Mac and phone. For the notes, the transcript text is sent to Purple Maia's model server (see AGENTS.md).

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
cp .env.example .env   # then fill in HF_TOKEN and the LLM_API_KEY from David
```

Create the backend's **access key** (a random secret the app must send with every request) and put it in both `.env` files. This command does it without showing the key:

```bash
k=$(python3 -c "import secrets;print(secrets.token_urlsafe(32))") && echo "API_ACCESS_KEY=$k" >> .env && echo "EXPO_PUBLIC_API_KEY=$k" >> mobile/.env
```

The first run downloads about 900 MB of models. Set `HF_HUB_OFFLINE=0` in `.env` for that run, then set it back to `1` so the server never contacts Hugging Face.

## Run the backend

```bash
cd backend
python3.12 -m venv .venv          # first time only
source .venv/bin/activate         # every new terminal
pip install -r requirements.txt   # first time only
uvicorn main:app --host 127.0.0.1 --port 8000
```

`--host 127.0.0.1` means only this Mac can reach the server, which is all browser testing needs. API docs: http://localhost:8000/docs (click **Authorize** and paste the access key to try requests).

**For phone testing**, use `--host 0.0.0.0` instead, so the phone can reach it over Wi-Fi. Be careful: on some networks (like a university's), the Mac has a **public** address, and `0.0.0.0` opens the server to the whole internet. We saw outside scanners connect within days. The access key keeps them out of every `/api` endpoint, but on those networks, prefer a **phone hotspot**: the Mac then gets a private address. Go back to `127.0.0.1` when you're done.

Models load in the background at startup (about 15 s). `GET /api/health` shows `"models_loaded": true` when they're ready.

**Test the whole flow** (in a second terminal, with the server running and the venv active). It uses consented or synthetic audio only and never prints transcript text:

```bash
cd backend && python smoke_test.py ../data/audio/test.wav
```

| File | Job |
| --- | --- |
| `main.py` | The API endpoints and the background job queue (one job at a time) |
| `transcribe.py` | The only file that uses WhisperX: convert → transcribe → align → identify speakers |
| `summarize.py` | The only file that calls the summary model (Purple's lmstudio-oahu server, `m3-ult` Qwen 35B). It writes structured session notes; to change the headings, edit `SECTIONS` there. If it fails, the transcript still arrives, with a warning. |
| `sessions.py` | Reads and writes `data/sessions/<id>.json`, `<id>.transcript.json` and `<id>.summary.json` |
| `config.py` | Loads `.env` (models, upload limit, access key) and sets the folder paths |
| `smoke_test.py` | End-to-end check against a running server |

## Run the mobile app

How the app is put together (screens, API layer, demo mode, config files): see [mobile/README.md](mobile/README.md).

`mobile/.env` (gitignored) holds two settings:

```
EXPO_PUBLIC_API_URL=http://localhost:8000     # browser on this Mac
EXPO_PUBLIC_API_KEY=<same value as API_ACCESS_KEY in .env>
```

For the **phone**, set `EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8000` (find it with `ipconfig getifaddr en0`; it changes when you change networks) and run the backend with `--host 0.0.0.0` (see above). Then start the app and scan the QR code with Expo Go (phone and Mac on the same Wi-Fi):

```bash
cd mobile
npm install      # first time only
npx expo start
```

Restart `npx expo start` after changing `mobile/.env`. For browser-only testing, `npx expo start --localhost` keeps the Expo dev server itself off the network too. It serves the app's code, including `EXPO_PUBLIC_` values.

**Demo mode:** without `EXPO_PUBLIC_API_URL`, the app uses a simulated backend (`mobile/src/lib/mock-api.ts`). Recording and file picking are real, but nothing is uploaded: status steps through the stages and a sample transcript comes back. Pick a file with "fail" in its name to see the failure screen.

## Privacy rules

- No cloud APIs. Audio stays on this Mac and phone. Transcript text goes only to Purple Maia's model server, for session notes, and only to Purple-controlled models (never `cloud-…`).
- Never commit audio, transcripts, session data or tokens.
- Never log transcript text.
- Participants are stored by ID (e.g. `youth-001`); names are display-only.
