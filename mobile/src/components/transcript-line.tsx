/**
 * TRANSCRIPT LINE: one line of the transcript, "[mm:ss] Name: what they said".
 *
 * Tapping the line opens a picker underneath to fix who really said it: the
 * session's participants, plus "Automatic" to undo a fix and go back to what
 * the speaker model decided. Fixed lines show a small "edited" mark. Fixes are
 * saved straight away (by participant ID) and also count in the participation
 * numbers. Only one line's picker is open at a time; the Transcript page keeps
 * track of which.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatClock } from "@/lib/format";
import { useColors } from "@/lib/theme";

type Props = {
  start: number;
  text: string;
  /** The name shown for this line, and its color. */
  name: string;
  color: string;
  /** True when staff have fixed who said this line. */
  fixed: boolean;
  /** The participant this line is credited to, if any (to highlight in the picker). */
  currentId: string | null;
  participants: { id: string; label: string }[];
  open: boolean;
  onToggle: () => void;
  onPick: (participantId: string | null) => void;
};

export function TranscriptLine({ start, text, name, color, fixed, currentId, participants, open, onToggle, onPick }: Props) {
  const colors = useColors();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${formatClock(start)}, ${name}${fixed ? " (edited)" : ""}: ${text}. Tap to change who said this.`}
        onPress={onToggle}
        style={({ pressed }) => [styles.segment, (open || pressed) && { backgroundColor: colors.surface }]}
      >
        <Text style={[styles.time, { color: colors.muted }]}>[{formatClock(start)}]</Text>
        <Text style={[styles.text, { color: colors.text }]}>
          <Text style={[styles.speaker, { color }]}>{name}: </Text>
          {text}
          {fixed && <Text style={[styles.edited, { color: colors.muted }]}> (edited)</Text>}
        </Text>
      </Pressable>

      {open && (
        <View style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.pickerTitle, { color: colors.muted }]}>Who said this?</Text>
          <View style={styles.chips}>
            {participants.map((p) => {
              const selected = p.id === currentId;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`This line was said by ${p.label}`}
                  onPress={() => onPick(p.id)}
                  style={[
                    styles.chip,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>{p.label}</Text>
                </Pressable>
              );
            })}
            {fixed && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Undo the fix for this line"
                onPress={() => onPick(null)}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.background }]}
              >
                <Text style={[styles.chipText, { color: colors.muted }]}>Automatic</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/** A line whose speaker withdrew consent: only its time is kept, nothing about who or what. */
export function RemovedLine({ start }: { start: number }) {
  const colors = useColors();
  return (
    <View style={styles.segment} accessibilityLabel={`${formatClock(start)}, removed: consent withdrawn`}>
      <Text style={[styles.time, { color: colors.muted }]}>[{formatClock(start)}]</Text>
      <Text style={[styles.text, styles.edited, { color: colors.muted }]}>[removed: consent withdrawn]</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
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
  edited: {
    fontSize: 13,
    fontStyle: "italic",
  },
  picker: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
});
