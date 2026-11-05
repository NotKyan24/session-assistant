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
 * Tapping a line lets staff fix who said it (TranscriptLine), for when the
 * speaker model got that line wrong. Lines removed because someone withdrew
 * consent show as "[removed: consent withdrawn]" and can't be changed.
 *
 * Privacy: the transcript is only shown on screen. It is never logged or saved
 * on the phone.
 */
import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text } from "react-native";

import { SpeakerNamer } from "@/components/speaker-namer";
import { RemovedLine, TranscriptLine } from "@/components/transcript-line";
import { useSessionResults } from "@/lib/session-results";
import { useColors } from "@/lib/theme";

export default function TranscriptPage() {
  const colors = useColors();
  const r = useSessionResults();
  // Withdrawn people can't be picked for a voice or a line.
  const participants = r.activeParticipants;
  // The one line whose "Who said this?" picker is open, if any.
  const [openLine, setOpenLine] = useState<number | null>(null);

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
      extraData={[openLine, r.lineSpeakers, r.speakerMap]}
      renderItem={({ item, index }) => {
        if (item.removed) {
          return <RemovedLine start={item.start} />;
        }
        const person = r.personOf(index);
        return (
          <TranscriptLine
            start={item.start}
            text={item.text.trim()}
            name={r.displayName(person)}
            color={r.colorFor(person)}
            fixed={String(index) in r.lineSpeakers}
            currentId={participants.some((p) => p.id === person) ? person : null}
            participants={participants}
            open={openLine === index}
            onToggle={() => setOpenLine(openLine === index ? null : index)}
            onPick={(participantId) => {
              r.fixLine(index, participantId);
              setOpenLine(null);
            }}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 0,
    gap: 10,
  },
  loading: {
    marginTop: 48,
  },
  text: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
});
