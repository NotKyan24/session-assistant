/**
 * SPEAKER NAMER: "Who's speaking?" on the Transcript screen.
 *
 * The speaker model only tells voices apart (Speaker 1, Speaker 2, ...). Here
 * staff say which participant each one is. Each choice is saved to the backend
 * straight away (by participant ID), and the transcript and notes then show
 * names instead of "Speaker N".
 *
 * It stays compact so the transcript isn't pushed off screen, even with many
 * voices: each voice is one row showing its current name ("Speaker 4 ·
 * Unknown ▾"). Tapping a row opens that voice's choices (every participant,
 * plus "Unknown"); picking one saves it and closes the row. The heading counts
 * how many voices are named.
 *
 * The color dot matches that speaker's color in the transcript.
 */
import { useState } from "react";
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
  // The one voice whose choices are open, if any.
  const [open, setOpen] = useState<string | null>(null);
  if (speakers.length === 0) return null;

  const labelFor = (id: string | null) => participants.find((p) => p.id === id)?.label ?? "Unknown";
  const named = speakers.filter((s) => speakerMap[s]).length;
  const options = [...participants.map((p) => ({ id: p.id as string | null, label: p.label })), { id: null, label: "Unknown" }];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.text }]}>{"Who's speaking?"}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>
        {named} of {speakers.length} voices named. Tap a voice to choose who it is.
      </Text>

      {speakers.map((speaker) => {
        const chosen = speakerMap[speaker] ?? null;
        const isOpen = open === speaker;
        return (
          <View key={speaker} style={[styles.speaker, { borderColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${speakerName(speaker)} is ${labelFor(chosen)}. Tap to change.`}
              onPress={() => setOpen(isOpen ? null : speaker)}
              style={styles.row}
            >
              <View style={[styles.dot, { backgroundColor: colorFor(speaker) }]} />
              <Text style={[styles.speakerText, { color: colors.text }]}>{speakerName(speaker)}</Text>
              <Text style={[styles.current, { color: chosen ? colorFor(speaker) : colors.muted }]} numberOfLines={1}>
                {labelFor(chosen)} {isOpen ? "▴" : "▾"}
              </Text>
            </Pressable>

            {isOpen && (
              <View style={styles.chips}>
                {options.map((option) => {
                  const selected = option.id === chosen;
                  return (
                    <Pressable
                      key={option.id ?? "unknown"}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${speakerName(speaker)} is ${option.label}`}
                      onPress={() => {
                        if (!selected) onChange(speaker, option.id);
                        setOpen(null);
                      }}
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
            )}
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
    gap: 6,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  note: {
    fontSize: 13,
    marginBottom: 4,
  },
  speaker: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
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
  current: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "600",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 6,
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
