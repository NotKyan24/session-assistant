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
 * It also owns speaker naming and line fixes:
 * - nameSpeaker() saves which participant a voice ("SPEAKER_00") is.
 * - fixLine() saves who really said one line, overriding its voice.
 * Every page shows the result straight away: personOf(i) gives each line's
 * person (line fix, then named voice, then the voice label), displayName()
 * and colorFor() work for both participant ids and voice labels, and rename()
 * swaps "Speaker 1" in AI-written text. Participation numbers are reloaded
 * after each change, since the backend counts them per person.
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
  /** Staff fixes for single lines: line number (as text) -> participant id. */
  lineSpeakers: Record<string, string>;
  /** Fix who said line `index`; null puts it back to automatic. */
  fixLine: (index: number, participantId: string | null) => Promise<void>;
  /** Who line `index` is credited to: a participant id, or a voice label if unnamed. */
  personOf: (index: number) => string;
  /** A participant id or voice label -> a name ("Kyan", or "Speaker 1" if unnamed). */
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
  const [lineSpeakers, setLineSpeakers] = useState<Record<string, string>>({});

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
        setLineSpeakers(s.line_speakers ?? {});
      },
      () => setSession(null),
    );
  }, [id]);

  // Participation is counted per person on the backend, so reload it after any change.
  function refreshMetrics() {
    api.getMetrics(id).then(setMetrics, () => {});
  }

  async function nameSpeaker(speaker: string, participantId: string | null) {
    setNamingError(null);
    try {
      setSpeakerMap(await api.setSpeakers(id, { [speaker]: participantId }));
      refreshMetrics();
    } catch (e) {
      setNamingError(e instanceof Error ? e.message : "Could not save that name.");
    }
  }

  async function fixLine(index: number, participantId: string | null) {
    setNamingError(null);
    try {
      setLineSpeakers(await api.setLineSpeaker(id, index, participantId));
      refreshMetrics();
    } catch (e) {
      setNamingError(e instanceof Error ? e.message : "Could not save that change.");
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
  const voices = speakers.filter((s) => s !== "Unknown");
  const participants = session?.participants ?? [];
  const participantById = (key: string) => participants.find((p) => p.id === key);

  const voiceColor = (label: string) =>
    label === "Unknown" ? UNKNOWN_COLOR : SPEAKER_COLORS[Math.max(0, voices.indexOf(label)) % SPEAKER_COLORS.length];

  // A participant uses the color of the voice they were named as, so their lines
  // match "Who's speaking?". Someone only reached through line fixes gets a color
  // after the voices' colors.
  const personColor = (key: string) => {
    if (!participantById(key)) return voiceColor(key);
    const voice = voices.find((v) => speakerMap[v] === key);
    if (voice) return voiceColor(voice);
    return SPEAKER_COLORS[(voices.length + participants.findIndex((p) => p.id === key)) % SPEAKER_COLORS.length];
  };

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
    lineSpeakers,
    fixLine,
    personOf: (index) => {
      const label = segments?.[index]?.speaker ?? "Unknown";
      return lineSpeakers[String(index)] ?? speakerMap[label] ?? label;
    },
    displayName: (key) => participantById(key)?.label ?? names[key] ?? speakerName(key),
    rename: speakerRenamer(names),
    // Unattributed speech is grey; everyone else gets their own color.
    colorFor: personColor,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSessionResults(): SessionResults {
  const value = useContext(Context);
  if (!value) throw new Error("useSessionResults must be used inside SessionResultsProvider");
  return value;
}
