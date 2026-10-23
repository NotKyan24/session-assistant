# Session Assistant: mobile app

The phone app staff use to run a session: confirm consent, record (or pick an audio file), wait while the Mac transcribes it, then read the transcript with speaker labels. It's an Expo (React Native) app, tested in Expo Go.

## The flow

```
Setup ──Start──▶ Record ──Stop/upload──▶ Status ──Ready──▶ Results (Notes · Participation · Transcript)
  ▲                                         │                  │
  └──────────────── New session ◀───────────┴──(failed)────────┘
```

| Step | Screen file | What happens | API call |
| --- | --- | --- | --- |
| 1 | `src/app/index.tsx` | Name the session, pick in person/video, choose who's here from the shared roster (add or remove people there), tick consent for each. Start stays disabled until everyone chosen has consented. | `getRoster`, `addPerson`, `removePerson`, `createSession` |
| 2 | `src/app/record.tsx` | Record with pause/resume, or choose an existing file. The screen stays awake while recording. | `uploadAudio` |
| 3 | `src/app/processing.tsx` | Checks progress every 3 s and shows the current stage. | `getSession` (repeated) |
| 4 | `src/app/session/[id]/` | **Results**, three tabs: **Notes** ("Who's speaking?" to match each voice to a participant, then the AI notes), **Participation** (speaking time and %, words, questions, who responds to whom, AI engagement notes) and **Transcript** (`[mm:ss] Name: text`). Names replace "Speaker N" on every tab. | `getSession`, `setSpeakers`, `getSummary`, `getMetrics`, `getTranscript` |

## How the code is organized

```
src/
  app/              screens (Expo Router: each file is a screen, named by its path)
    _layout.tsx     the navigator that stacks the screens
    index.tsx       Setup        record.tsx   Record
    processing.tsx  Status
    session/[id]/   Results: _layout.tsx (the tab bar), notes.tsx,
                    participation.tsx, transcript.tsx
  components/       reusable pieces of UI
    button.tsx        the one button style
    consent-row.tsx   a participant's consent checkbox
    level-meter.tsx   the microphone loudness bar
    stage-list.tsx    the processing checklist
    summary-card.tsx  the AI-written session notes
    roster-row.tsx    a roster person: in today's session? / remove
    add-person-form.tsx  add someone to the roster
    speaker-namer.tsx "Who's speaking?": match voices to participants
    participation-card.tsx  participation numbers and who responds to whom
    tab-button.tsx    a tab in the results tab bar
  lib/              logic with no UI
    api.ts            the only code that talks to the backend
    session-results.tsx  data shared by the three results tabs (+ speaker names)
    mock-api.ts       the simulated backend for demo mode
    participants.ts   the hard-coded test roster
    format.ts         date, timer and speaker-name formatting
    theme.ts          light and dark colors
```

Each file starts with a comment explaining its job.

## Demo mode and the real backend

`src/lib/api.ts` decides where requests go:

- **No `EXPO_PUBLIC_API_URL` set (today):** demo mode. `mock-api.ts` pretends to be the backend on the phone. Recording and file picking are real, but nothing is uploaded. The stages tick by over about 12 seconds, then a sample transcript appears. A picked file with "fail" in its name shows the failure screen. The Setup screen shows a "Demo mode" banner.
- **`EXPO_PUBLIC_API_URL` set in `mobile/.env`:** real HTTP calls to the FastAPI backend, sending `EXPO_PUBLIC_API_KEY` as the `X-API-Key` header on every request (it must match `API_ACCESS_KEY` in the root `.env`). On the phone, over local Wi-Fi, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000`. `mobile/.env` is gitignored. Restart `npx expo start` after changing it.

No screen code changes between the two.

## Libraries added for this app

All installed with `npx expo install` so the versions match Expo SDK 57, and all work in Expo Go.

| Package | Used for |
| --- | --- |
| `expo-audio` | Recording, pause/resume, the timer and the loudness level |
| `expo-keep-awake` | Keeping the screen on while recording. In Expo Go, a locked screen stops the recording. |
| `expo-document-picker` | "Choose a file instead" |
| `expo-asset` | Required by `expo-audio` (flagged by `npx expo-doctor`) |

## Config files (JSON can't hold comments, so they're explained here)

- **`app.json`:** the app's settings. Two additions under `plugins`:
  - `expo-audio` with `microphonePermission`: the message iOS shows when asking for the mic ("Used to record sessions you start."). Expo Go shows its own message; this one applies to real app builds later.
  - `expo-asset`: added automatically when it was installed.
- **`package.json` / `package-lock.json`:** the dependency list; the packages above were added. Several Expo packages were also bumped by a patch version (`npx expo install --fix`) to match SDK 57.
- **`../.claude/launch.json`:** lets Claude Code preview the web build in its built-in browser (`npm --prefix mobile run web`). Not needed to run the app.

## Run it

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go on a phone on the same Wi-Fi as the Mac. Expo Go must support SDK 57.

Before calling work done, run these from `mobile/`:

```bash
npx tsc --noEmit
```

```bash
npx expo lint
```

## Privacy, as it applies to the app

- Participants are sent by `id`; `label` is display text only.
- The transcript is only shown on screen. It's not logged or saved on the phone.
- In demo mode nothing leaves the phone. With a backend, audio goes only to the Mac on local Wi-Fi.

## Known limits (Day 1)

- The level meter only moves while recording, because expo-audio reports loudness only during a recording.
- The phone must stay unlocked while recording. A development build could record with the screen locked (a stretch goal).
- No upload progress bar yet (a stretch goal).
