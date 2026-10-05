Session Assistant: a self-hosted tool that records counseling and meeting sessions, transcribes them with speaker labels, and (later) summarizes them. Users are staff at a youth-serving nonprofit, so privacy rules are strict.

## Stack

- `backend/`: Python 3.11 + FastAPI. WhisperX runs locally on an Apple M3 MacBook: CPU only, model `small`, compute_type `int8`, language `en`.
- `mobile/`: the existing Expo (React Native) app, tested in Expo Go. Keep it; never replace it with a web framework.
- The phone reaches the backend over local Wi-Fi at the Mac's IP, set in one config value: `EXPO_PUBLIC_API_URL` in `mobile/.env` (not localhost).
- `data/`: gitignored. `audio/` and `sessions/` (one JSON file per session, no database).

## Rules

- No cloud APIs. Audio and transcripts never leave this Mac and phone.
- Never commit audio, transcripts, session data or tokens. Keep them in the gitignored `data/` folder and `.env`.
- Never log transcript text. Logs carry stages and timings only.
- Participants are stored by ID (e.g. `youth-001`); names are display-only.
- Keep the WhisperX call behind one module (`backend/transcribe.py`) with a single function: audio file path in, segments with speaker/start/end/text out, so the engine can be swapped later.
- WhisperX's API changes between versions: read the installed version's README before writing diarization code; never guess.
- Use Expo libraries that work in Expo Go.
- Show a short plan before writing code for each phase.

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
