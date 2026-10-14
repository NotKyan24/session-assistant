/**
 * STAGE LIST: the processing checklist on the Status screen.
 *
 * Each stage shows one of four looks:
 *   ✓ done (green) · ● in progress (blue, highlighted) · ○ waiting (grey)
 *   ✕ failed (red)
 * It works out which is which by comparing each stage's position with the
 * current (or failed) stage's position.
 */
import { StyleSheet, Text, View } from "react-native";

import type { Stage } from "@/lib/api";
import { useColors } from "@/lib/theme";

// The stages in order: the backend's name (`key`) and what the user sees (`label`).
export const STAGES: { key: Stage; label: string }[] = [
  { key: "uploaded", label: "Uploading" },
  { key: "converting", label: "Converting" },
  { key: "transcribing", label: "Transcribing" },
  { key: "aligning", label: "Aligning" },
  { key: "identifying_speakers", label: "Identifying speakers" },
  { key: "summarizing", label: "Summarizing" },
  { key: "ready", label: "Ready" },
];

type Props = {
  /** Stage in progress (or reached). */
  current: Stage;
  /** Stage that failed, if any. */
  failedAt?: Stage;
};

export function StageList({ current, failedAt }: Props) {
  const colors = useColors();
  const marker = failedAt ?? current;
  const currentIndex = STAGES.findIndex((s) => s.key === marker);

  return (
    <View style={styles.list}>
      {STAGES.map((stage, index) => {
        const done = currentIndex > index || (stage.key === "ready" && current === "ready");
        const active = index === currentIndex && !done;
        const failed = failedAt === stage.key;
        const color = failed ? colors.danger : done ? colors.success : active ? colors.primary : colors.muted;
        const icon = failed ? "✕" : done ? "✓" : active ? "●" : "○";

        return (
          <View
            key={stage.key}
            style={[styles.row, active && { backgroundColor: colors.surface }]}
            accessibilityLabel={`${stage.label}: ${failed ? "failed" : done ? "done" : active ? "in progress" : "waiting"}`}
          >
            <Text style={[styles.icon, { color }]}>{icon}</Text>
            <Text style={[styles.label, { color: active || failed ? colors.text : color }, (active || failed) && styles.bold]}>
              {stage.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  icon: {
    width: 20,
    fontSize: 16,
    textAlign: "center",
  },
  label: {
    fontSize: 17,
  },
  bold: {
    fontWeight: "600",
  },
});
