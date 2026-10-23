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
import type { Api, Metrics, Person, Segment, SessionStatus, Stage, Summary } from "./api";
import { TEST_PARTICIPANTS } from "./participants";

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
  mode: "in_person" | "video";
  createdAt: string;
  participants: { id: string; label: string; consented: boolean }[];
  speakerMap: Record<string, string>;
  // When the upload happened (milliseconds), or null before any upload.
  uploadedAt: number | null;
  /** File names containing "fail" simulate a failed job. */
  shouldFail: boolean;
};

// All mock sessions, by id. In memory only.
const sessions = new Map<string, MockSession>();

// The demo roster, in memory; starts with the Day 1 test participants.
let roster: Person[] = [...TEST_PARTICIPANTS];

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
  engagement: [
    { speaker: "Speaker 1", note: "Asked most of the questions and moved the conversation between topics." },
    { speaker: "Speaker 2", note: "Gave longer, detailed answers, especially about the science project." },
  ],
  model: "demo",
  created_at: "2026-10-14T00:00:00Z",
};

// A small version of backend/metrics.py, so demo mode shows real numbers for the sample.
function sampleMetrics(segments: Segment[]): Metrics {
  const per = new Map<string, { seconds: number; words: number; questions: number }>();
  const pairs = new Map<string, number>();
  let previous: string | null = null;
  for (const seg of segments) {
    const s = per.get(seg.speaker) ?? { seconds: 0, words: 0, questions: 0 };
    s.seconds += seg.end - seg.start;
    s.words += seg.text.split(/\s+/).filter(Boolean).length;
    s.questions += (seg.text.match(/\?/g) ?? []).length;
    per.set(seg.speaker, s);
    if (previous && previous !== seg.speaker) {
      const key = `${previous}|${seg.speaker}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    previous = seg.speaker;
  }
  const total = [...per.values()].reduce((sum, s) => sum + s.seconds, 0);
  const length = Math.max(0, ...segments.map((s) => s.end));
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    session: {
      length_seconds: round1(length),
      speaking_seconds: round1(total),
      silence_percent: length ? round1((100 * (length - total)) / length) : 0,
    },
    speakers: [...per.entries()]
      .map(([speaker, s]) => ({
        speaker,
        speaking_seconds: round1(s.seconds),
        percent: total ? round1((100 * s.seconds) / total) : 0,
        words: s.words,
        words_per_minute: s.seconds ? Math.round(s.words / (s.seconds / 60)) : 0,
        questions: s.questions,
      }))
      .sort((a, b) => b.speaking_seconds - a.speaking_seconds),
    interactions: [...pairs.entries()]
      .map(([key, count]) => {
        const [from, to] = key.split("|");
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count),
  };
}

// Small waits so the app shows its loading states, like over a real network.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A unique id, prefixed "mock-" so it's obvious where it came from.
function newId(): string {
  return `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Walks through the stages, subtracting each stage's duration from the time
// since upload. The stage where the time runs out is the current one.
function currentStatus(session: MockSession): SessionStatus {
  const base = { id: session.id, name: session.name, participants: session.participants, speaker_map: session.speakerMap };
  if (session.uploadedAt === null) {
    return { ...base, status: "created", stage: "created" };
  }
  let elapsed = (Date.now() - session.uploadedAt) / 1000;
  for (const [stage, seconds] of STAGE_SECONDS) {
    if (elapsed < seconds) {
      // Like the real backend, only the long stages report a percentage.
      const reportsProgress = stage === "transcribing" || stage === "aligning" || stage === "identifying_speakers";
      const progress = reportsProgress ? Math.round((elapsed / seconds) * 1000) / 10 : null;
      return { ...base, status: stage, stage, progress, seconds_left: reportsProgress ? Math.ceil(seconds - elapsed) : null };
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
    sessions.set(id, {
      id,
      name: session.name,
      mode: session.mode,
      createdAt: new Date().toISOString(),
      participants: session.participants,
      speakerMap: {},
      uploadedAt: null,
      shouldFail: false,
    });
    return { id };
  },

  async uploadAudio(id, file, onProgress) {
    const session = sessions.get(id);
    if (!session) throw new Error("Session not found");
    // Pretend to send the file in a few steps so the progress display can be seen.
    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      await delay(200);
      onProgress?.(fraction);
    }
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

  async listSessions({ q = "", includeHidden = false, offset = 0 }) {
    await delay(150);
    const query = q.trim().toLowerCase();
    const all = [...sessions.values()]
      .filter((s) => includeHidden || s.uploadedAt !== null)
      .filter(
        (s) =>
          !query ||
          [s.name, ...s.participants.flatMap((p) => [p.label, p.id])].some((t) => t.toLowerCase().includes(query)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = all.slice(offset, offset + 30).map((s) => ({
      id: s.id,
      name: s.name,
      mode: s.mode,
      created_at: s.createdAt,
      status: currentStatus(s).status,
      failed_stage: currentStatus(s).failed_stage ?? null,
      participants: s.participants.map(({ id, label }) => ({ id, label })),
      length_seconds: currentStatus(s).status === "ready" ? Math.max(...SAMPLE_TRANSCRIPT.map((x) => x.end)) : null,
      has_summary: currentStatus(s).status === "ready",
      hidden: s.uploadedAt === null,
    }));
    return { sessions: page, total: all.length, has_more: offset + page.length < all.length };
  },

  async getMetrics(id) {
    const session = sessions.get(id);
    if (!session) throw new Error("Session not found");
    return sampleMetrics(SAMPLE_TRANSCRIPT);
  },

  async setSpeakers(id, changes) {
    const session = sessions.get(id);
    if (!session) throw new Error("Session not found");
    for (const [speaker, personId] of Object.entries(changes)) {
      if (personId === null) delete session.speakerMap[speaker];
      else session.speakerMap[speaker] = personId;
    }
    return { ...session.speakerMap };
  },

  async getRoster() {
    await delay(150);
    return [...roster];
  },

  async addPerson(person) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(person.id)) {
      throw new Error("IDs can only use letters, numbers, - and _ (up to 64 characters), e.g. youth-004.");
    }
    if (roster.some((p) => p.id === person.id)) throw new Error(`${person.id} is already on the roster.`);
    const added = { id: person.id, label: person.label.trim() || person.id };
    roster = [...roster, added];
    return added;
  },

  async removePerson(personId) {
    roster = roster.filter((p) => p.id !== personId);
  },
};
