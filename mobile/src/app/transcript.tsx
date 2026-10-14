/**
 * TRANSCRIPT SCREEN (flow step 4 of 4): Setup → Record → Status → **Transcript**
 *
 * At the top: the AI-written session notes (SummaryCard), if the backend made
 * them. If it couldn't (e.g. the summary model was down), a short note says so
 * and the transcript still shows.
 *
 * Below: the read-only transcript. Each segment (a stretch of
 * speech by one person) shows as:
 *   [mm:ss] Speaker 1: what they said
 * Each speaker gets their own color. WhisperX labels speakers SPEAKER_00,
 * SPEAKER_01, ...; we show them as "Speaker 1", "Speaker 2". Matching speakers
 * to actual participants is a later step, not part of Day 1.
 *
 * Privacy: the transcript and notes are only shown on screen. They are never
 * logged or saved on the phone.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/button";
import { SummaryCard } from "@/components/summary-card";
import { api, type Segment, type Summary } from "@/lib/api";
import { formatClock, speakerName } from "@/lib/format";
import { SPEAKER_COLORS, useColors } from "@/lib/theme";

export default function TranscriptScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // undefined = still loading, null = this session has no summary.
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Load the transcript and the summary once when the screen opens, side by side.
  // A summary problem never blocks the transcript.
  useEffect(() => {
    api.getTranscript(id).then(setSegments, (e) => setError(e instanceof Error ? e.message : "Could not load the transcript."));
    api.getSummary(id).then(setSummary, (e) => {
      setSummary(null);
      setSummaryError(e instanceof Error ? e.message : "Could not load the summary.");
    });
  }, [id]);

  // Each speaker's color: the first speaker heard gets the first color, and so on.
  const speakers = [...new Set(segments?.map((s) => s.speaker) ?? [])];
  const colorFor = (speaker: string) => SPEAKER_COLORS[speakers.indexOf(speaker) % SPEAKER_COLORS.length];

  // Shown above the transcript lines.
  const header = (
    <View style={styles.header}>
      {summary === undefined && <ActivityIndicator />}
      {summary && <SummaryCard summary={summary} />}
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
            <Text style={[styles.speaker, { color: colorFor(item.speaker) }]}>{speakerName(item.speaker)}: </Text>
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
