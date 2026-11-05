# Session Assistant roadmap

What comes after the Day 1 end-to-end path, in the order we plan to work on it. Last updated Oct 21, 2026.

**Day 1 is in place:** consent-gated setup, recording or picking a file (phone and browser), upload, WhisperX transcription with speaker labels, AI session notes from Purple's model server, progress with time left, and an access key on the API.

## Next up

| # | Topic | Status |
| --- | --- | --- |
| 1 | Speaker naming | ✅ Done (Oct 21) |
| 2 | Shared participant roster | ✅ Done (Oct 21) |
| 3 | Participation metrics and risk notes in summaries | ✅ Participation done (Oct 22); risk notes need Joe's input |
| 4 | Session history | ✅ Past sessions screen done (Oct 22); retention, delete and export wait on Joe |
| 5 | Hawaiian words and names | Planned; needs a starter glossary |
| 6 | In person vs. video | ✅ Removed (Nov 2) |
| 7 | Team testing, then real use | Deferred until the planned features are done (decided Nov 2) |

### 1. Speaker naming

The speaker model only tells voices apart ("Speaker 1", "Speaker 2"). On the Transcript screen, staff choose which participant each speaker is, and the transcript and notes then show names. The mapping is stored by participant ID (e.g. `SPEAKER_00 → facilitator`), never by name. Matching voices automatically from a voice sample is a possible later step; it needs a consent decision about storing voiceprints.

### 2. Shared participant roster

Today's participants are hard-coded test IDs. The roster becomes a list on the backend (`data/roster.json`, never committed) that every device shares. Staff add people (an ID like `youth-004` plus a display name) and remove them, then pick who's in each session on the Setup screen. Consent stays per person, per session. A proper roster database with sign-in comes with item 7.

### 3. Participation metrics and risk notes

**Participation, per person**, computed from the timestamped transcript (exact, not AI-guessed):
- speaking time and % of the session
- turns and average turn length
- words spoken and questions asked
- interactions: who responds to whom

An AI-written engagement note sits alongside these, labeled as AI-written. This works best after speaker naming.

**Emotional/behavioral risk notes** are the most sensitive output. Ground rules:
- They're framed as **possible concerns for staff review**, never diagnoses.
- Every flag cites a timestamp and a short quote as evidence.
- The tool is never the only safeguard: it can miss things or over-flag, especially with Pidgin and cultural speech.
- **Before building, Joe or a clinical lead defines** the categories and what staff must do when one appears, including any self-harm or mandated-reporting protocol.

### 4. Session history

Every session is already saved: its details, consent times, transcript, notes and audio. What's missing is a **Past sessions** screen (list, search by date or participant, open a session) and the rules around it. **Joe decides:**
- what's kept and for how long (including the audio)
- who can see it
- whether staff need an export (e.g. PDF)

Long-term, storage moves off the laptop to a Purple server, probably into a small database with backups.

### 5. Hawaiian words and names

Whisper mishears Hawaiian words and names (e.g. "Kain" for Kyan). The plan:
1. **Vocabulary hints:** give Whisper participant names and a glossary before it transcribes. This stays on the Mac.
2. **Correction pass:** Purple's `m3-ult` model fixes misheard glossary words and names, with ʻokina and kahakō, keeping the original for comparison. Text only, which is already allowed.

Both need a **glossary** of Hawaiian words, place names and people's names, started by Joe or staff. Purple's larger Whisper model is an option, but it sends audio off the Mac, so it needs Joe's approval.

### 6. In person vs. video

Removed on Nov 2: the toggle never changed anything, so Setup now has just the session name and one Participants list (here today + consent on each row). The saved `mode` was also removed from existing sessions. If video sessions ever need their own handling (e.g. uploading the call's own recording), it can come back with a real purpose.

### 7. Team testing, then real use

**Deferred** until the planned features are in place. The plan so far, so it's ready when we pick it up:

- **Expo Go isn't for shipping** (Expo's docs call it a playground). Testers get a real app built with Expo Build (formerly EAS Build), and later changes reach them through Expo Update without a reinstall.
- **Joe uses an iPhone.** First build: **internal distribution** (register his iPhone once, install from a link, no Apple review). Later, **TestFlight** for more testers (up to 100 on Purple's team). Both need **Purple's Apple Developer account** ($99/yr) and an Expo account or organization.
- **Fallback:** the backend serves the app's web build, so testers can use a **web link** in Safari.
- **Before any of that:**
  - **per-tester sign-in** (username + password, tokens that expire, accounts you can disable, sessions record who created them), replacing the shared key built into the app
  - a **"test version" banner**: test or consented staff recordings only, no youth sessions
- **Team testing**, with test audio only:
  - the backend on a **Purple server** with an `https://` address (ideally the RTX 6000 GPU machine). Audio then leaves this Mac, which needs Joe's OK and an AGENTS.md rule update.
- **Real staff use additionally needs:**
  - sign-in and roles, with per-person access
  - Purple's data policy: retention, deletion, access, consent records
  - likely a privacy review

No real counseling recordings go through the system until then.

## Speaker accuracy (Nov 2)

With many people (11 in a 10-minute test), similar voices got merged: "at most 11" found 10 speakers, one with 19% of the talk. Now:
- **Exact headcount:** speaker identification looks for exactly as many voices as people marked "here today". The Setup screen asks staff to mark only people who will speak.
- **Line fixes:** on the Transcript tab, tap a line to say who really said it. Participation numbers count per person, so fixes and two voices named as the same person are combined.

Still open: re-identify speakers on an existing session without re-uploading; per-participant Zoom audio files for video calls; optional voice samples (needs Joe's OK on storing voiceprints).

## Smaller items

- Show the time-left estimate only after a stage is about 15–20% done (early estimates are unreliable).
- Keep phone recordings in the app's documents folder (iOS can clear the cache mid-session) and delete them after upload.
- Finish Day 1: a 5-minute phone recording with pause/resume, then the "Day 1 end-to-end path" commit.
- Long sessions: measure a real 1-hour recording; decide whether overnight processing is acceptable or a GPU server is needed.

## Questions for Joe (and David)

- **Hawaiian:** who can start the glossary?
- **Hosting:** which Purple server (and its `https://` address, login, disk space, backups)? Does Purple have an Apple Developer account and an Expo organization you can be added to? Is it OK for audio to go to that server?
- **Notes:** are the four headings right (topics, concerns, goals / next steps, follow-ups)?
- **Risk notes:** which categories, and what's the staff protocol when one is flagged?
- **Data:** what's kept, for how long, and who can see it? Is export needed?
- **David:** is `m3-ult` Purple-owned, and is Cloudflare in the path acceptable for transcripts?
