/**
 * SPEAKER NAMER: "Who's speaking?" on the Transcript screen.
 *
 * The speaker model only tells voices apart (Speaker 1, Speaker 2, ...). Here
 * staff say which participant each one is, by tapping a name. "Unknown" clears
 * it. Each choice is saved to the backend straight away (by participant ID),
 * and the transcript and notes then show names instead of "Speaker N".
 *
 * The color dot matches that speaker's color in the transcript, which helps
 * when listening back or reading who said what.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { speakerName } from "@/lib/format";
import { useColors } from "@/lib/theme";

type Props = {
  /** Speaker labels in the transcript, in order of first appearance. */
  speakers: string[];
  participants: { id: string; label: string }[];
  /** Current choices: speaker label -> participant id. */
  speakerMap: Record<string, string>;
  colorFor: (speaker: string) => string;
  onChange: (speaker: string, participantId: string | null) => void;
  error?: string | null;
};

export function SpeakerNamer({ speakers, participants, speakerMap, colorFor, onChange, error }: Props) {
  const colors = useColors();
  if (speakers.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.text }]}>{"Who's speaking?"}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>Tap the person each voice belongs to.</Text>
      {speakers.map((speaker) => {
        const chosen = speakerMap[speaker] ?? null;
        const options = [...participants.map((p) => ({ id: p.id as string | null, label: p.label })), { id: null, label: "Unknown" }];
        return (
          <View key={speaker} style={styles.speaker}>
            <View style={styles.speakerLabel}>
              <View style={[styles.dot, { backgroundColor: colorFor(speaker) }]} />
              <Text style={[styles.speakerText, { color: colors.text }]}>{speakerName(speaker)}</Text>
            </View>
            <View style={styles.chips}>
              {options.map((option) => {
                const selected = option.id === chosen;
                return (
                  <Pressable
                    key={option.id ?? "unknown"}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${speakerName(speaker)} is ${option.label}`}
                    onPress={() => !selected && onChange(speaker, option.id)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colorFor(speaker) : colors.border,
                        backgroundColor: selected ? colorFor(speaker) : colors.background,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: selected ? "#FFFFFF" : colors.text }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
      {error && <Text style={[styles.note, { color: colors.danger }]}>{error}</Text>}
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
  speaker: {
    gap: 8,
    marginTop: 4,
  },
  speakerLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  speakerText: {
    fontSize: 15,
    fontWeight: "700",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
});
