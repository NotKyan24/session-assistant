/**
 * SUMMARY CARD: the AI-written session notes, at the top of the Transcript screen.
 *
 * Shows the overview paragraph, then each section (e.g. "Topics discussed")
 * as a bulleted list. Empty sections show "None noted". The sections come
 * from the backend (backend/summarize.py), so new headings appear here
 * without app changes.
 *
 * It's labeled as AI-written: staff should check it against the transcript
 * before relying on it.
 */
import { StyleSheet, Text, View } from "react-native";

import type { Summary } from "@/lib/api";
import { useColors } from "@/lib/theme";

type Props = {
  summary: Summary;
  /** Optional text swap, e.g. "Speaker 1" -> the name staff assigned. */
  rename?: (text: string) => string;
};

export function SummaryCard({ summary, rename = (text) => text }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Session notes</Text>
      <Text style={[styles.note, { color: colors.muted }]}>Written by AI from the transcript. Check before relying on it.</Text>

      {summary.overview ? <Text style={[styles.body, { color: colors.text }]}>{rename(summary.overview)}</Text> : null}

      {summary.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
          {section.items.length === 0 ? (
            <Text style={[styles.body, { color: colors.muted }]}>None noted</Text>
          ) : (
            section.items.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.body, { color: colors.muted }]}>•</Text>
                <Text style={[styles.body, styles.bulletText, { color: colors.text }]}>{rename(item)}</Text>
              </View>
            ))
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
  section: {
    gap: 4,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
  },
  bulletText: {
    flex: 1,
  },
});
