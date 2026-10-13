/**
 * CONSENT ROW: one participant's consent checkbox on the Setup screen.
 *
 * Tapping anywhere on the row toggles it. It shows "Consented" or "Not yet"
 * on the right, and screen readers announce it as a checkbox:
 * "<label> consents to recording, checked/unchecked".
 * The row only displays the state; the Setup screen stores it.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/lib/theme";

type Props = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

export function ConsentRow({ label, checked, onToggle }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${label} consents to recording`}
      onPress={onToggle}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <View
        style={[
          styles.box,
          { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : "transparent" },
        ]}
      >
        {checked && <Text style={[styles.tick, { color: colors.onPrimary }]}>✓</Text>}
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.status, { color: checked ? colors.success : colors.muted }]}>
        {checked ? "Consented" : "Not yet"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: {
    fontSize: 16,
    fontWeight: "700",
  },
  label: {
    flex: 1,
    fontSize: 17,
  },
  status: {
    fontSize: 14,
  },
});
