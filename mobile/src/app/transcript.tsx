/**
 * TRANSCRIPT SCREEN (flow step 4 of 4): Setup → Record → Status → **Transcript**
 *
 * At the top: the AI-written session notes (SummaryCard), if the backend made
 * them. If it couldn't (e.g. the summary model was down), a short note says so
 * and the transcript still shows.
 *
 * Then "Who's speaking?" (SpeakerNamer): staff say which participant each
 * voice is, and from then on the transcript and notes show names instead of
 * "Speaker 1". The choice is saved on the backend by participant ID.
 *
 * Below: the read-only transcript. Each segment (a stretch of
 * speech by one person) shows as:
 *   [mm:ss] Speaker 1: what they said
 * Each speaker gets their own color. WhisperX labels speakers SPEAKER_00,
 * SPEAKER_01, ...; we show them as "Speaker 1", "Speaker 2" until named.
 *
 * Privacy: the transcript and notes are only shown on screen. They are never
 * logged or saved on the phone.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/button";
import { SpeakerNamer } from "@/components/speaker-namer";
import { SummaryCard } from "@/components/summary-card";
import { api, type Segment, type SessionStatus, type Summary } from "@/lib/api";
import { formatClock, speakerName, speakerRenamer } from "@/lib/format";
import { SPEAKER_COLORS, useColors } from "@/lib/theme";

export default function TranscriptScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // undefined = still loading, null = this session has no summary.
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  // The session's participants and saved speaker names.
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});
  const [namingError, setNamingError] = useState<string | null>(null);

  // Load the transcript and the summary once when the screen opens, side by side.
  // A summary problem never blocks the transcript.
  useEffect(() => {
    api.getTranscript(id).then(setSegments, (e) => setError(e instanceof Error ? e.message : "Could not load the transcript."));
    api.getSummary(id).then(setSummary, (e) => {
      setSummary(null);
      setSummaryError(e instanceof Error ? e.message : "Could not load the summary.");
    });
    // Naming is optional: if this fails, the transcript still shows with "Speaker N".
    api.getSession(id).then(
      (s) => {
        setSession(s);
        setSpeakerMap(s.speaker_map ?? {});
      },
      () => setSession(null),
    );
  }, [id]);

  // Save one speaker's name; the screen updates as soon as the backend confirms.
  async function nameSpeaker(speaker: string, participantId: string | null) {
    setNamingError(null);
    try {
      setSpeakerMap(await api.setSpeakers(id, { [speaker]: participantId }));
    } catch (e) {
      setNamingError(e instanceof Error ? e.message : "Could not save that name.");
    }
  }

  // Speaker label -> display name, for the speakers staff have named.
  const participants = session?.participants ?? [];
  const names: Record<string, string> = {};
  for (const [speaker, personId] of Object.entries(speakerMap)) {
    const person = participants.find((p) => p.id === personId);
    if (person) names[speaker] = person.label;
  }
  const displayName = (speaker: string) => names[speaker] ?? speakerName(speaker);

  // Each speaker's color: the first speaker heard gets the first color, and so on.
  const speakers = [...new Set(segments?.map((s) => s.speaker) ?? [])];
  const colorFor = (speaker: string) => SPEAKER_COLORS[speakers.indexOf(speaker) % SPEAKER_COLORS.length];

  // Shown above the transcript lines.
  const header = (
    <View style={styles.header}>
      {summary === undefined && <ActivityIndicator />}
      {segments && segments.length > 0 && participants.length > 0 && (
        <SpeakerNamer
          speakers={speakers.filter((s) => s !== "Unknown")}
          participants={participants}
          speakerMap={speakerMap}
          colorFor={colorFor}
          onChange={nameSpeaker}
          error={namingError}
        />
      )}
      {summary && <SummaryCard summary={summary} rename={speakerRenamer(names)} />}
      {summary === null && (
        <Text style={[styles.text, { color: colors.muted }]}>
          {summaryError ?? "No session notes for this recording. The transcript is below."}
        </Text>
      )}
      <Text style={[styles.title, { color: colors.text }]}>Transcript</Text>
    </View>
  );

  const newSession = <Button title="New session" onPress={() => router.dismissTo("/")} style={styles.footer} />;

  // Three states: error, still loading (spinner), or the list of segments.
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={[styles.text, { color: colors.danger }]}>{error}</Text>
        {newSession}
      </View>
    );
  }

  if (!segments) {
    return <ActivityIndicator style={styles.loading} size="large" />;
  }

  return (
    // FlatList only draws the rows on screen, so long sessions stay smooth.
    <FlatList
      data={segments}
      keyExtractor={(s, i) => `${i}-${s.start}`}
      contentContainerStyle={styles.container}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={[styles.text, { color: colors.muted }]}>No speech was found in this recording.</Text>}
      renderItem={({ item }) => (
        <View style={styles.segment}>
          <Text style={[styles.time, { color: colors.muted }]}>[{formatClock(item.start)}]</Text>
          <Text style={[styles.text, { color: colors.text }]}>
            <Text style={[styles.speaker, { color: colorFor(item.speaker) }]}>{displayName(item.speaker)}: </Text>
            {item.text.trim()}
          </Text>
        </View>
      )}
      ListFooterComponent={newSession}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 14,
  },
  loading: {
    marginTop: 48,
  },
  header: {
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  segment: {
    flexDirection: "row",
    gap: 10,
  },
  time: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    paddingTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  speaker: {
    fontWeight: "700",
  },
  footer: {
    marginTop: 16,
  },
});
