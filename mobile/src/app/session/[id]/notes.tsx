/**
 * NOTES PAGE (first results tab): "Who's speaking?" at the top, so voices are
 * named before anyone reads the results, then the AI session notes.
 * Names chosen here apply on every results page.
 */
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";

import { SpeakerNamer } from "@/components/speaker-namer";
import { SummaryCard } from "@/components/summary-card";
import { useSessionResults } from "@/lib/session-results";
import { useColors } from "@/lib/theme";

export default function NotesPage() {
  const colors = useColors();
  const r = useSessionResults();
  const participants = r.session?.participants ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {r.error && <Text style={[styles.text, { color: colors.danger }]}>{r.error}</Text>}

      {r.segments && r.segments.length > 0 && participants.length > 0 && (
        <SpeakerNamer
          speakers={r.speakers.filter((s) => s !== "Unknown")}
          participants={participants}
          speakerMap={r.speakerMap}
          colorFor={r.colorFor}
          onChange={r.nameSpeaker}
          error={r.namingError}
        />
      )}

      {r.summary === undefined && <ActivityIndicator />}
      {r.summary && <SummaryCard summary={r.summary} rename={r.rename} />}
      {r.summary === null && (
        <Text style={[styles.text, { color: colors.muted }]}>
          {r.summaryError ?? "No session notes for this recording. Participation and the transcript are still available."}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
});
