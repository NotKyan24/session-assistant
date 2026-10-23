/**
 * SESSION RESULTS: data shared by the three result pages (Notes,
 * Participation, Transcript) of one finished session.
 *
 * The session's tab layout (src/app/session/[id]/_layout.tsx) wraps its pages
 * in <SessionResultsProvider>. It loads everything once (the session with its
 * participants and speaker names, the transcript, the notes and the
 * participation numbers), so switching tabs is instant. Pages read it with
 * useSessionResults().
 *
 * It also owns speaker naming: nameSpeaker() saves a choice to the backend,
 * and every page shows the new name straight away through displayName() (for
 * "SPEAKER_00" labels) and rename() (for "Speaker 1" in AI-written text).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { api, type Metrics, type Segment, type SessionStatus, type Summary } from "./api";
import { speakerName, speakerRenamer } from "./format";
import { SPEAKER_COLORS } from "./theme";

type SessionResults = {
  id: string;
  session: SessionStatus | null;
  /** null while loading. */
  segments: Segment[] | null;
  /** undefined while loading, null when this session has no notes. */
  summary: Summary | null | undefined;
  summaryError: string | null;
  /** null while loading (or if it failed; see metricsError). */
  metrics: Metrics | null;
  metricsError: string | null;
  /** A problem loading the transcript; the pages show it instead of content. */
  error: string | null;
  /** Speaker labels in order of first appearance (includes "Unknown"). */
  speakers: string[];
  speakerMap: Record<string, string>;
  nameSpeaker: (speaker: string, participantId: string | null) => Promise<void>;
  namingError: string | null;
  /** "SPEAKER_00" -> the assigned participant's name, or "Speaker 1". */
  displayName: (speaker: string) => string;
  /** Swaps "Speaker 1" etc. in AI-written text for assigned names. */
  rename: (text: string) => string;
  colorFor: (speaker: string) => string;
};

const UNKNOWN_COLOR = "#98A2B3";

const Context = createContext<SessionResults | null>(null);

export function SessionResultsProvider({ id, children }: { id: string; children: ReactNode }) {
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});
  const [namingError, setNamingError] = useState<string | null>(null);

  // Load everything once, side by side. Notes, metrics and names are optional:
  // if one fails, the others still show.
  useEffect(() => {
    api.getTranscript(id).then(setSegments, (e) => setError(e instanceof Error ? e.message : "Could not load the transcript."));
    api.getSummary(id).then(setSummary, (e) => {
      setSummary(null);
      setSummaryError(e instanceof Error ? e.message : "Could not load the notes.");
    });
    api.getMetrics(id).then(setMetrics, (e) =>
      setMetricsError(e instanceof Error ? e.message : "Could not load the participation numbers."),
    );
    api.getSession(id).then(
      (s) => {
        setSession(s);
        setSpeakerMap(s.speaker_map ?? {});
      },
      () => setSession(null),
    );
  }, [id]);

  async function nameSpeaker(speaker: string, participantId: string | null) {
    setNamingError(null);
    try {
      setSpeakerMap(await api.setSpeakers(id, { [speaker]: participantId }));
    } catch (e) {
      setNamingError(e instanceof Error ? e.message : "Could not save that name.");
    }
  }

  // Speaker label -> display name, for the speakers staff have named.
  const names: Record<string, string> = {};
  for (const [speaker, personId] of Object.entries(speakerMap)) {
    const person = session?.participants?.find((p) => p.id === personId);
    if (person) names[speaker] = person.label;
  }

  // Each speaker's color: the first speaker heard gets the first color, and so on.
  const speakers = [...new Set(segments?.map((s) => s.speaker) ?? [])];

  const value: SessionResults = {
    id,
    session,
    segments,
    summary,
    summaryError,
    metrics,
    metricsError,
    error,
    speakers,
    speakerMap,
    nameSpeaker,
    namingError,
    displayName: (speaker) => names[speaker] ?? speakerName(speaker),
    rename: speakerRenamer(names),
    // Unattributed speech is grey; everyone else gets their own color.
    colorFor: (speaker) =>
      speaker === "Unknown"
        ? UNKNOWN_COLOR
        : SPEAKER_COLORS[Math.max(0, speakers.filter((s) => s !== "Unknown").indexOf(speaker)) % SPEAKER_COLORS.length],
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSessionResults(): SessionResults {
  const value = useContext(Context);
  if (!value) throw new Error("useSessionResults must be used inside SessionResultsProvider");
  return value;
}
