/**
 * SESSION ROW: one past session in the Past sessions list.
 *
 * Shows the session name and a status label (Ready, Processing, Failed),
 * then the date and time, in person/video and the recording length (or which
 * stage failed), then who took part.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SessionListItem } from "@/lib/api";
import { formatClock, formatSessionDate } from "@/lib/format";
import { useColors } from "@/lib/theme";

const STAGE_LABELS: Record<string, string> = {
  uploaded: "Uploading",
  converting: "Converting",
  transcribing: "Transcribing",
  aligning: "Aligning",
  identifying_speakers: "Identifying speakers",
  summarizing: "Summarizing",
};

type Props = {
  session: SessionListItem;
  onPress: () => void;
};

export function SessionRow({ session, onPress }: Props) {
  const colors = useColors();
  const { status } = session;
  const badge =
    status === "ready"
      ? { label: "Ready", color: colors.success }
      : status === "failed"
        ? { label: "Failed", color: colors.danger }
        : status === "created"
          ? { label: "Not recorded", color: colors.muted }
          : { label: "Processing", color: colors.primary };

  const details = [
    formatSessionDate(session.created_at),
    session.mode === "video" ? "Video" : "In person",
    status === "failed"
      ? `${STAGE_LABELS[session.failed_stage ?? ""] ?? "Processing"} failed`
      : session.length_seconds
        ? formatClock(session.length_seconds)
        : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.name}, ${badge.label}, ${details.join(", ")}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.top}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {session.name}
        </Text>
        <Text style={[styles.badge, { color: badge.color, borderColor: badge.color }]}>{badge.label}</Text>
      </View>
      <Text style={[styles.meta, { color: colors.muted }]}>{details.join(" · ")}</Text>
      <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
        {session.participants.map((p) => p.label).join(", ")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
  },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  meta: {
    fontSize: 14,
  },
});
