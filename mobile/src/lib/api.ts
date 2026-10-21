/**
 * API LAYER: the one place the app talks to the backend.
 *
 * Screens never call `fetch` directly. They call the four functions on `api`,
 * which match the backend's four endpoints:
 *   createSession  → POST /api/sessions               (Setup screen)
 *   uploadAudio    → POST /api/sessions/{id}/audio    (Record screen)
 *   getSession     → GET  /api/sessions/{id}          (Status screen, polled)
 *   getTranscript  → GET  /api/sessions/{id}/transcript (Transcript screen)
 *   getSummary     → GET  /api/sessions/{id}/summary    (Transcript screen)
 *
 * Two implementations share the same shape (the `Api` type):
 * - `httpApi` makes real network calls to EXPO_PUBLIC_API_URL (the Mac's
 *   address on local Wi-Fi, set in mobile/.env).
 * - `mockApi` (mock-api.ts) simulates the backend on the phone.
 * The last line of this file picks one: mock when no URL is set, real
 * otherwise. Switching to the real backend is a config change; no screen
 * code changes.
 *
 * The types below describe the data exchanged with the backend.
 */
import { mockApi } from "./mock-api";
import { uploadFile } from "./upload";

// "Where" the session happens, chosen on the Setup screen.
export type SessionMode = "in_person" | "video";

// The backend's processing stages, in order. "created" means no audio yet.
export type Stage =
  | "created"
  | "uploaded"
  | "converting"
  | "transcribing"
  | "aligning"
  | "identifying_speakers"
  | "summarizing"
  | "ready"
  | "failed";

// What the Setup screen sends to create a session.
export type NewSession = {
  name: string;
  mode: SessionMode;
  participants: { id: string; label: string; consented: boolean }[];
};

// What the Status screen gets back each time it polls.
export type SessionStatus = {
  id: string;
  name: string;
  status: Stage;
  stage: Stage;
  /** How far the current stage is, 0-100; null for stages that don't report it. */
  progress?: number | null;
  /** Rough seconds left in the current stage, once there's enough progress to estimate. */
  seconds_left?: number | null;
  /** Stage that failed, when status is "failed". */
  failed_stage?: Stage;
  // Why it failed (shown to the user).
  error?: string | null;
  // Non-fatal problems, e.g. speakers couldn't be identified.
  warnings?: string[];
};

// One line of the transcript: who spoke, when (in seconds), and what they said.
export type Segment = {
  speaker: string;
  start: number;
  end: number;
  text: string;
};

// Structured session notes written by the summary model (see backend/summarize.py).
// The headings come from the backend, so the app shows whatever sections it sends.
export type Summary = {
  overview: string;
  sections: { title: string; items: string[] }[];
  model: string;
  created_at: string;
};

// A file on the phone, ready to upload: where it is, its name and its type.
export type AudioFile = {
  uri: string;
  name: string;
  mimeType: string;
};

// The contract both implementations follow.
export type Api = {
  createSession(session: NewSession): Promise<{ id: string }>;
  /** onProgress gets 0-1 as the file is sent (on phones; the browser reports only the end). */
  uploadAudio(id: string, file: AudioFile, onProgress?: (fraction: number) => void): Promise<void>;
  getSession(id: string): Promise<SessionStatus>;
  getTranscript(id: string): Promise<Segment[]>;
  /** null when the session has no summary (e.g. the summary model was unavailable). */
  getSummary(id: string): Promise<Summary | null>;
};

// Read from mobile/.env when the app starts (restart Expo after changing it).
// A trailing slash is dropped so paths join cleanly.
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

// The backend's access key (API_ACCESS_KEY in the root .env), sent with every
// request. EXPO_PUBLIC_ values are built into the app, so this keeps strangers
// on the network out; it isn't a per-user password.
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

/** True when no backend URL is configured and the app runs on simulated data. */
export const isMock = !API_URL;

// Shared helper for real calls: sends the request, and on an error status
// turns the backend's message (FastAPI's `detail` field) into an Error the
// screens can show.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (API_KEY) headers.set("X-API-Key", API_KEY);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(errorDetail(res.status, await res.text()));
  return (await res.json()) as T;
}

// FastAPI puts its error message in a "detail" field; fall back to the status code.
function errorDetail(status: number, bodyText: string): string {
  try {
    const body = JSON.parse(bodyText);
    if (body?.detail) return typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
  } catch {
    // Not JSON; use the status code.
  }
  return `Server error (HTTP ${status})`;
}

// The real implementation: plain HTTP calls to the FastAPI backend.
const httpApi: Api = {
  createSession: (session) =>
    request("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    }),

  // Uploads go as multipart form data, the standard way to send a file over HTTP.
  // upload.ts (browser) and upload.native.ts (phone) do the sending; Expo picks
  // the right one for the platform.
  async uploadAudio(id, file, onProgress) {
    const headers: Record<string, string> = API_KEY ? { "X-API-Key": API_KEY } : {};
    const { status, body } = await uploadFile(`${API_URL}/api/sessions/${id}/audio`, file, headers, onProgress);
    if (status < 200 || status >= 300) throw new Error(errorDetail(status, body));
  },

  getSession: (id) => request(`/api/sessions/${id}`),

  getTranscript: async (id) => {
    const body = await request<{ segments: Segment[] }>(`/api/sessions/${id}/transcript`);
    return body.segments;
  },

  getSummary: async (id) => {
    try {
      const body = await request<{ summary: Summary }>(`/api/sessions/${id}/summary`);
      return body.summary;
    } catch (e) {
      // The backend answers "no summary" with a 404 message; treat it as "none", not an error.
      if (e instanceof Error && e.message.startsWith("There's no summary")) return null;
      throw e;
    }
  },
};

// The switch: screens import `api` and never need to know which one they got.
export const api: Api = isMock ? mockApi : httpApi;
