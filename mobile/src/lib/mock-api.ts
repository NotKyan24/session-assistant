/**
 * SIMULATED BACKEND ("demo mode"), used while EXPO_PUBLIC_API_URL is unset.
 *
 * It lets the whole flow be tried before the real backend exists. It follows
 * the same `Api` contract as the real one (see api.ts), so screens behave the
 * same either way.
 *
 * What it does:
 * - Keeps sessions in memory on the phone (they vanish when the app reloads).
 * - Rejects a session if anyone hasn't consented, like the real backend will.
 * - "Uploads" by recording the time. Nothing leaves the phone, and the audio
 *   isn't read at all.
 * - Works out the current stage from how long ago the upload happened, using
 *   the timings in STAGE_SECONDS (about 14 seconds in total).
 * - Returns a fixed sample transcript and sample session notes (a made-up
 *   check-in) once "ready".
 * - Simulates a failure at the Converting stage if the uploaded file's name
 *   contains "fail", to test the failure screen.
 */
import type { Api, Segment, SessionStatus, Stage, Summary } from "./api";

// How long each simulated stage lasts, in seconds, in order.
const STAGE_SECONDS: [Stage, number][] = [
  ["uploaded", 1],
  ["converting", 2],
  ["transcribing", 4],
  ["aligning", 2],
  ["identifying_speakers", 3],
  ["summarizing", 2],
];

// What the mock remembers about each session.
type MockSession = {
  id: string;
  name: string;
  // When the upload happened (milliseconds), or null before any upload.
  uploadedAt: number | null;
  /** File names containing "fail" simulate a failed job. */
  shouldFail: boolean;
};

// All mock sessions, by id. In memory only.
const sessions = new Map<string, MockSession>();

// Shaped exactly like the real WhisperX output (speaker / start / end / text).
const SAMPLE_TRANSCRIPT: Segment[] = [
  { speaker: "SPEAKER_00", start: 0.1, end: 4.2, text: "Hi, thanks for coming in today. How has your week been so far?" },
  { speaker: "SPEAKER_01", start: 4.8, end: 10.6, text: "Pretty good, actually. School was busy, but I finished my science project on Tuesday." },
  { speaker: "SPEAKER_00", start: 11.1, end: 13.9, text: "That's great to hear. What was the project about?" },
  { speaker: "SPEAKER_01", start: 14.5, end: 20.9, text: "We built a small water filter out of sand, gravel and charcoal." },
  { speaker: "SPEAKER_00", start: 21.5, end: 23.8, text: "Nice. Did it work the way you expected?" },
  { speaker: "SPEAKER_01", start: 24.5, end: 30.6, text: "Mostly. The first try was still cloudy, so we added another layer of sand." },
  { speaker: "SPEAKER_00", start: 31.2, end: 35.9, text: "That sounds like good problem solving." },
];

// Same shape as backend/summarize.py produces.
const SAMPLE_SUMMARY: Summary = {
  overview:
    "A weekly check-in. Speaker 2 finished a science project and has moved to midfield on their team. They're sleeping a little better after putting their phone away earlier.",
  sections: [
    { title: "Topics discussed", items: ["Science project (water filter)", "Sports team and new position", "Sleep and morning tiredness"] },
    { title: "Concerns raised", items: ["Feeling tired in the mornings (improving)"] },
    { title: "Goals / next steps", items: ["Start the reading assignment early instead of Sunday night"] },
    { title: "Follow-ups", items: ["Check in on the reading assignment next session"] },
  ],
  model: "demo",
  created_at: "2026-10-14T00:00:00Z",
};

// Small waits so the app shows its loading states, like over a real network.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A unique id, prefixed "mock-" so it's obvious where it came from.
function newId(): string {
  return `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Walks through the stages, subtracting each stage's duration from the time
// since upload. The stage where the time runs out is the current one.
function currentStatus(session: MockSession): SessionStatus {
  const base = { id: session.id, name: session.name };
  if (session.uploadedAt === null) {
    return { ...base, status: "created", stage: "created" };
  }
  let elapsed = (Date.now() - session.uploadedAt) / 1000;
  for (const [stage, seconds] of STAGE_SECONDS) {
    if (elapsed < seconds) {
      return { ...base, status: stage, stage };
    }
    elapsed -= seconds;
    if (session.shouldFail && stage === "converting") {
      return {
        ...base,
        status: "failed",
        stage: "failed",
        failed_stage: "converting",
        error: "Simulated failure: the audio file could not be read.",
      };
    }
  }
  return { ...base, status: "ready", stage: "ready" };
}

export const mockApi: Api = {
  async createSession(session) {
    await delay(300);
    const missing = session.participants.filter((p) => !p.consented);
    if (missing.length > 0) {
      throw new Error(`Missing consent: ${missing.map((p) => p.id).join(", ")}`);
    }
    const id = newId();
    sessions.set(id, { id, name: session.name, uploadedAt: null, shouldFail: false });
    return { id };
  },

  async uploadAudio(id, file) {
    const session = sessions.get(id);
    if (!session) throw new Error("Session not found");
    await delay(800);
    session.uploadedAt = Date.now();
    session.shouldFail = file.name.toLowerCase().includes("fail");
  },

  async getSession(id) {
    const session = sessions.get(id);
    if (!session) throw new Error("Session not found");
    return currentStatus(session);
  },

  async getTranscript(id) {
    const session = sessions.get(id);
    if (!session) throw new Error("Session not found");
    if (currentStatus(session).status !== "ready") throw new Error("Transcript not ready");
    return SAMPLE_TRANSCRIPT;
  },

  async getSummary(id) {
    const session = sessions.get(id);
    if (!session) throw new Error("Session not found");
    if (currentStatus(session).status !== "ready") throw new Error("Summary not ready");
    return SAMPLE_SUMMARY;
  },
};
