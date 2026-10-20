Session Assistant: a self-hosted tool that records counseling and meeting sessions, transcribes them with speaker labels, and (later) summarizes them. Users are staff at a youth-serving nonprofit, so privacy rules are strict.

## Stack

- `backend/`: Python 3.12 (python.org build, venv in `backend/.venv`) + FastAPI. WhisperX runs locally on an Apple M3 MacBook: CPU only, model `small`, compute_type `int8`, language `en`.
- `mobile/`: the existing Expo (React Native) app, tested in Expo Go. Keep it; never replace it with a web framework.
- The phone reaches the backend over local Wi-Fi at the Mac's IP, set in one config value: `EXPO_PUBLIC_API_URL` in `mobile/.env` (not localhost).
- `data/`: gitignored. `audio/` and `sessions/` (one JSON file per session, no database).

## Rules

- No cloud APIs. Audio never leaves this Mac and phone. Transcripts stay local too, except for summarization: transcript text may go only to Purple Maia's model server (`LLM_BASE_URL`, currently lmstudio-oahu.purplemaia.org, which sits behind Cloudflare) over HTTPS. Kyan has permission to send data there. Use only Purple-controlled models (the chosen one is `m3-ult-…`, which by its name runs on an M3 Ultra Mac, pending David's confirmation). Never `cloud-…`, `cloud-syn:…` or `chatgpt-…` models: they forward to outside companies (api.synthetic.new, ollama.com, OpenAI).
- Never commit audio, transcripts, session data or tokens. Keep them in the gitignored `data/` folder and `.env`.
- Never log transcript text. Logs carry stages and timings only.
- Every `/api` endpoint except `/api/health` requires the access key (`X-API-Key` header = `API_ACCESS_KEY` in `.env`; the app sends `EXPO_PUBLIC_API_KEY`). Keep new endpoints behind `dependencies=protected`. Run the backend with `--host 127.0.0.1` unless testing on a phone: on this Mac's university network, `0.0.0.0` is reachable from the internet, and scanners found it on Oct 20, 2026.
- Participants are stored by ID (e.g. `youth-001`); names are display-only.
- Keep the WhisperX call behind one module (`backend/transcribe.py`) with a single function: audio file path in, segments with speaker/start/end/text out, so the engine can be swapped later.
- WhisperX's API changes between versions: read the installed version's README before writing diarization code; never guess.
- Use Expo libraries that work in Expo Go.
- Show a short plan before writing code for each phase.

## Planned: summarization (after the backend works end to end)

Requested by Joe (project manager), Oct 7, 2026. Don't build it until sessions, upload and transcription work end to end.

- **Model:** `m3-ult-qwen3.6-35b-a3b-ud-q6kl-mtp2-262k` on lmstudio-oahu.purplemaia.org (Kyan chose it on Oct 15, 2026, after comparing it with `meshllm` and `m3-ult-qwen3.6-27b` on a synthetic clip: about 18 s per summary, a 262k context so a whole session fits in one request). It's reached through `LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL` in `.env` (an OpenAI-compatible LiteLLM gateway). The fallback is llm.labs.purplemaia.org. Open questions for David: whether `m3-ult` is Purple-owned, and whether Cloudflare in the path is acceptable.
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
