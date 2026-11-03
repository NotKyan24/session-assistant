/**
 * NOTES PAGE (first results tab): the AI session notes. Voices named on the
 * Transcript tab ("Who's speaking?") show here as names instead of "Speaker 1".
 */
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";

import { SummaryCard } from "@/components/summary-card";
import { useSessionResults } from "@/lib/session-results";
import { useColors } from "@/lib/theme";

export default function NotesPage() {
  const colors = useColors();
  const r = useSessionResults();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {r.error && <Text style={[styles.text, { color: colors.danger }]}>{r.error}</Text>}

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
