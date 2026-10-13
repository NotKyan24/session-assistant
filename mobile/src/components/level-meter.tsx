/**
 * LEVEL METER: a horizontal bar showing how loud the microphone input is.
 *
 * expo-audio reports loudness in decibels (dBFS): 0 is the loudest possible
 * and very negative numbers mean silence. We map -60 dB (quiet room) → empty
 * bar and 0 dB → full bar. The bar turns red near the top, which means the
 * input is too loud and may distort.
 *
 * It only moves while recording: expo-audio reports loudness only during a
 * recording.
 */
import { StyleSheet, View } from "react-native";

import { useColors } from "@/lib/theme";

type Props = {
  /** Level in dBFS from expo-audio metering (about -160 silent to 0 loudest). */
  db: number | undefined;
  active: boolean;
};

// Anything quieter than this shows as an empty bar.
const FLOOR_DB = -60;

export function LevelMeter({ db, active }: Props) {
  const colors = useColors();
  // Convert decibels to a 0–1 fill amount, clamped so it never over- or under-fills.
  const level = active && db !== undefined ? Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB)) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Microphone level"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(level * 100) }}
      style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View
        style={[
          styles.fill,
          { width: `${level * 100}%`, backgroundColor: level > 0.9 ? colors.danger : colors.success },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
