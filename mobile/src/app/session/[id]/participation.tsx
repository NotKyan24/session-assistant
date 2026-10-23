/**
 * PARTICIPATION PAGE (second results tab): the measured participation numbers
 * (ParticipationCard), then the AI-written engagement note for each person.
 * Engagement notes describe only how people took part (how much they spoke,
 * questions, answer length), never emotions or behavior.
 */
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { ParticipationCard } from "@/components/participation-card";
import { useSessionResults } from "@/lib/session-results";
import { useColors } from "@/lib/theme";

export default function ParticipationPage() {
  const colors = useColors();
  const r = useSessionResults();
  const engagement = r.summary?.engagement ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {r.error && <Text style={[styles.text, { color: colors.danger }]}>{r.error}</Text>}
      {!r.metrics && !r.metricsError && !r.error && <ActivityIndicator />}
      {r.metricsError && (
        <Text style={[styles.text, { color: colors.danger }]}>
          {`Participation numbers aren't available: ${r.metricsError}`}
        </Text>
      )}
      {r.metrics && r.metrics.speakers.length === 0 && (
        <Text style={[styles.text, { color: colors.muted }]}>No speech was found in this recording.</Text>
      )}
      {r.metrics && r.metrics.speakers.length > 0 && (
        <ParticipationCard metrics={r.metrics} displayName={r.displayName} colorFor={r.colorFor} />
      )}

      {engagement.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.text }]}>Engagement</Text>
          <Text style={[styles.note, { color: colors.muted }]}>Written by AI from the transcript. Check before relying on it.</Text>
          {engagement.map((e) => (
            <Text key={e.speaker} style={[styles.text, { color: colors.text }]}>
              <Text style={styles.bold}>{r.rename(e.speaker)}: </Text>
              {r.rename(e.note)}
            </Text>
          ))}
        </View>
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
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  note: {
    fontSize: 13,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  bold: {
    fontWeight: "700",
  },
});
