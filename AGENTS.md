Session Assistant: a self-hosted tool that records counseling and meeting sessions, transcribes them with speaker labels, and (later) summarizes them. Users are staff at a youth-serving nonprofit, so privacy rules are strict.

## Stack

- `backend/`: Python 3.12 (python.org build, venv in `backend/.venv`) + FastAPI. WhisperX runs locally on an Apple M3 MacBook: CPU only, model `small`, compute_type `int8`, language `en`.
- `mobile/`: the existing Expo (React Native) app, tested in Expo Go. Keep it; never replace it with a web framework.
- The phone reaches the backend over local Wi-Fi at the Mac's IP, set in one config value: `EXPO_PUBLIC_API_URL` in `mobile/.env` (not localhost).
- `data/`: gitignored. `audio/` and `sessions/` (one JSON file per session, no database).

## Rules

- No cloud APIs. Audio never leaves this Mac and phone. Transcripts stay local too, except for summarization: transcript text may go only to Purple Maia's model server (`LLM_BASE_URL`, currently llm.labs.purplemaia.org) over HTTPS. Kyan has permission to send data there. Use only Purple-controlled models: `lcpp-…` (Purple's server on the Jetstream2 research cloud) or, if David confirms, `meshllm/…`. Never `cloud-…` models: they forward to outside companies (api.synthetic.new, ollama.com).
- Never commit audio, transcripts, session data or tokens. Keep them in the gitignored `data/` folder and `.env`.
- Never log transcript text. Logs carry stages and timings only.
- Participants are stored by ID (e.g. `youth-001`); names are display-only.
- Keep the WhisperX call behind one module (`backend/transcribe.py`) with a single function: audio file path in, segments with speaker/start/end/text out, so the engine can be swapped later.
- WhisperX's API changes between versions: read the installed version's README before writing diarization code; never guess.
- Use Expo libraries that work in Expo Go.
- Show a short plan before writing code for each phase.

## Planned: summarization (after the backend works end to end)

Requested by Joe (project manager), Oct 7, 2026. Don't build it until sessions, upload and transcription work end to end.

- **Model:** Purple's model server, reached through `LLM_BASE_URL` + `LLM_API_KEY` in `.env` (an OpenAI-compatible LiteLLM gateway). Planned model: `lcpp-qwen3.6-27b-q4-ud-kxl-262k` (llama.cpp on Purple's Jetstream2 server, 262k-token context, so a whole session fits in one request), set by `LLM_MODEL`. Avoid `cloud-…` models.
- **When:** automatically after transcription, as one more stage: … → Identifying speakers → Summarizing → Ready.
- **Format:** structured session notes under fixed headings (e.g. topics discussed, concerns raised, goals / next steps). Staff or Joe confirm the headings.
- **Shape:** `backend/summarize.py` with one function, `summarize(segments) -> notes`, the same swappable pattern as `transcribe.py`. Save the notes next to the transcript in `data/sessions/`. Never log or commit them.
- **App:** a Summary section on the Transcript screen.

## Expo (mobile/): do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo or React Native API:

1. Read the major version of `expo` in `mobile/package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt and follow its links; never answer from memory.

Run these from `mobile/`:

```bash
npx expo install <package>  # ALWAYS use instead of npm add; resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
```

Run lint and typecheck before declaring mobile work done.

- Use Expo Router. Routes live in `mobile/src/app/` (every file is a screen, `_layout.tsx` files define navigators). Keep components, hooks and utils outside `src/app/`.
- `ios/` and `android/` are generated; never create or edit them by hand. Configure native behavior in `app.json`.
