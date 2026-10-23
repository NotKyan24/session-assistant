/**
 * TAB BUTTON: one tab ("Notes", "Participation", "Transcript") in the tab bar
 * at the top of a finished session's results. The selected tab is filled in.
 * Expo Router's TabTrigger passes isFocused and the press handler to it.
 */
import type { TabTriggerSlotProps } from "expo-router/ui";
import { Pressable, StyleSheet, Text } from "react-native";

import { useColors } from "@/lib/theme";

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps & { children: string }) {
  const colors = useColors();
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={[styles.tab, { backgroundColor: isFocused ? colors.primary : "transparent" }]}
    >
      <Text style={[styles.label, { color: isFocused ? colors.onPrimary : colors.text }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
});
