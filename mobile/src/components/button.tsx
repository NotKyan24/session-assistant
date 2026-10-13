/**
 * BUTTON: the app's one button style, used on every screen.
 *
 * - variant: "primary" (blue, main action), "secondary" (grey, other options),
 *   "danger" (red: Record and Stop).
 * - size: "large" for the big, easy-to-tap buttons (Start, Record).
 * - disabled: greyed out and not tappable (e.g. Start before consent).
 * It tells screen readers it's a button and whether it's disabled.
 */
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { useColors } from "@/lib/theme";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "normal" | "large";
  style?: ViewStyle;
};

export function Button({ title, onPress, disabled, variant = "primary", size = "normal", style }: Props) {
  const colors = useColors();
  const background =
    variant === "secondary" ? colors.surface : variant === "danger" ? colors.danger : colors.primary;
  const foreground = variant === "secondary" ? colors.text : colors.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        size === "large" && styles.large,
        {
          backgroundColor: disabled ? colors.disabled : background,
          borderColor: variant === "secondary" ? colors.border : "transparent",
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.label, size === "large" && styles.largeLabel, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  large: {
    minHeight: 72,
    borderRadius: 36,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  largeLabel: {
    fontSize: 22,
  },
});
