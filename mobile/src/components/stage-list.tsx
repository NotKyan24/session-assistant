/**
 * STAGE LIST: the processing checklist on the Status screen.
 *
 * Each stage shows one of four looks:
 *   ✓ done (green) · ● in progress (blue, highlighted) · ○ waiting (grey)
 *   ✕ failed (red)
 * It works out which is which by comparing each stage's position with the
 * current (or failed) stage's position.
 *
 * Long stages (transcribing, aligning, identifying speakers) also show a
 * percentage and, once the backend can estimate it, the time left. On a
 * long recording, that's how you can tell it's working rather than stuck.
 */
import { StyleSheet, Text, View } from "react-native";

import type { Stage } from "@/lib/api";
import { formatTimeLeft } from "@/lib/format";
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
  /** Progress of the current stage, 0-100, if it reports one. */
  progress?: number | null;
  /** Estimated seconds left in the current stage, if known. */
  secondsLeft?: number | null;
};

export function StageList({ current, failedAt, progress, secondsLeft }: Props) {
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
        const showProgress = active && progress != null;

        return (
          <View
            key={stage.key}
            style={[styles.row, active && { backgroundColor: colors.surface }]}
            accessibilityLabel={`${stage.label}: ${failed ? "failed" : done ? "done" : active ? `in progress${showProgress ? `, ${Math.floor(progress)} percent` : ""}` : "waiting"}`}
          >
            <Text style={[styles.icon, { color }]}>{icon}</Text>
            <View style={styles.labelColumn}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: active || failed ? colors.text : color }, (active || failed) && styles.bold]}>
                  {stage.label}
                </Text>
                {showProgress && <Text style={[styles.percent, { color: colors.primary }]}>{Math.floor(progress)}%</Text>}
              </View>
              {showProgress && (
                <View style={[styles.track, { backgroundColor: colors.border }]}>
                  <View style={[styles.fill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
                </View>
              )}
              {active && secondsLeft != null && (
                <Text style={[styles.timeLeft, { color: colors.muted }]}>{formatTimeLeft(secondsLeft)}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  labelColumn: {
    flex: 1,
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  percent: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
  timeLeft: {
    fontSize: 13,
  },
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
