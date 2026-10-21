# Session Assistant roadmap

What comes after the Day 1 end-to-end path, in the order we plan to work on it. Last updated Oct 21, 2026.

**Day 1 is in place:** consent-gated setup, recording or picking a file (phone and browser), upload, WhisperX transcription with speaker labels, AI session notes from Purple's model server, progress with time left, and an access key on the API.

## Next up

| # | Topic | Status |
| --- | --- | --- |
| 1 | Speaker naming | Next |
| 2 | Shared participant roster | Next, built together with 1 |
| 3 | Participation metrics and risk notes in summaries | Planned; risk notes need Joe's input |
| 4 | Session history | Planned; needs Joe's data rules |
| 5 | Hawaiian words and names | Planned; needs a starter glossary |
| 6 | In person vs. video | Waiting on Joe |
| 7 | Team testing, then real use | Waiting on hosting |

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

The toggle is saved with each session but doesn't change anything yet. Options: give video sessions their own guidance (upload the call's own recording; speaker limit = people on the call), or remove the toggle until its purpose is decided.

### 7. Team testing, then real use

- **Team testing**, with test audio only:
  - the backend on a Purple server with an `https://` address (ideally with a GPU)
  - the app distributed through EAS Build to TestFlight and an Android test build
- **Real staff use additionally needs:**
  - sign-in and roles, with per-person access
  - Purple's data policy: retention, deletion, access, consent records
  - likely a privacy review

No real counseling recordings go through the system until then.

## Smaller items

- Show the time-left estimate only after a stage is about 15–20% done (early estimates are unreliable).
- Keep phone recordings in the app's documents folder (iOS can clear the cache mid-session) and delete them after upload.
- Finish Day 1: a 5-minute phone recording with pause/resume, then the "Day 1 end-to-end path" commit.
- Long sessions: measure a real 1-hour recording; decide whether overnight processing is acceptable or a GPU server is needed.

## Questions for Joe (and David)

- **Video toggle:** what should it change? Is there a recording flow doc?
- **Hawaiian:** who can start the glossary?
- **Hosting:** which Purple server, and is there an Apple Developer account for TestFlight?
- **Notes:** are the four headings right (topics, concerns, goals / next steps, follow-ups)?
- **Risk notes:** which categories, and what's the staff protocol when one is flagged?
- **Data:** what's kept, for how long, and who can see it? Is export needed?
- **David:** is `m3-ult` Purple-owned, and is Cloudflare in the path acceptable for transcripts?
