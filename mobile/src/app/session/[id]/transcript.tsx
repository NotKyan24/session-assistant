/**
 * TRANSCRIPT PAGE (third results tab): "Who's speaking?" at the top, then the
 * transcript lines.
 *
 * "Who's speaking?" (SpeakerNamer) matches each voice to a participant. It sits
 * here so staff can read who said what while naming the voices. Names chosen
 * here apply on every results tab (notes, participation, transcript).
 *
 * Each segment (a stretch of speech by one person) shows as
 *   [mm:ss] Name: what they said
 * with one color per speaker. Unnamed voices show as "Speaker 1", "Speaker 2".
 *
 * Privacy: the transcript is only shown on screen. It is never logged or saved
 * on the phone.
 */
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { SpeakerNamer } from "@/components/speaker-namer";
import { formatClock } from "@/lib/format";
import { useSessionResults } from "@/lib/session-results";
import { useColors } from "@/lib/theme";

export default function TranscriptPage() {
  const colors = useColors();
  const r = useSessionResults();
  const participants = r.session?.participants ?? [];

  if (r.error) {
    return <Text style={[styles.container, styles.text, { color: colors.danger }]}>{r.error}</Text>;
  }
  if (!r.segments) {
    return <ActivityIndicator style={styles.loading} size="large" />;
  }

  return (
    // FlatList only draws the rows on screen, so long sessions stay smooth.
    <FlatList
      data={r.segments}
      keyExtractor={(s, i) => `${i}-${s.start}`}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        r.segments.length > 0 && participants.length > 0 ? (
          <SpeakerNamer
            speakers={r.speakers.filter((s) => s !== "Unknown")}
            participants={participants}
            speakerMap={r.speakerMap}
            colorFor={r.colorFor}
            onChange={r.nameSpeaker}
            error={r.namingError}
          />
        ) : null
      }
      ListEmptyComponent={<Text style={[styles.text, { color: colors.muted }]}>No speech was found in this recording.</Text>}
      renderItem={({ item }) => (
        <View style={styles.segment}>
          <Text style={[styles.time, { color: colors.muted }]}>[{formatClock(item.start)}]</Text>
          <Text style={[styles.text, { color: colors.text }]}>
            <Text style={[styles.speaker, { color: r.colorFor(item.speaker) }]}>{r.displayName(item.speaker)}: </Text>
            {item.text.trim()}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 0,
    gap: 14,
  },
  loading: {
    marginTop: 48,
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
});
