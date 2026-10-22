/**
 * ROSTER ROW: one person on the shared roster, on the Setup screen.
 *
 * - Tapping the row includes or excludes them from today's session.
 * - "Remove" takes them off the roster for future sessions. It asks for a
 *   second tap to confirm, because a single tap is easy to hit by accident.
 *   Past sessions keep their own record of who took part.
 * Shows the ID under the name when they differ, since the ID is what's stored.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Person } from "@/lib/api";
import { useColors } from "@/lib/theme";

type Props = {
  person: Person;
  included: boolean;
  onToggle: () => void;
  onRemove: () => void;
};

export function RosterRow({ person, included, onToggle, onRemove }: Props) {
  const colors = useColors();
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: included }}
        accessibilityLabel={`${person.label} is in this session`}
        onPress={onToggle}
        style={styles.main}
      >
        <View
          style={[
            styles.box,
            { borderColor: included ? colors.primary : colors.border, backgroundColor: included ? colors.primary : "transparent" },
          ]}
        >
          {included && <Text style={[styles.tick, { color: colors.onPrimary }]}>✓</Text>}
        </View>
        <View style={styles.names}>
          <Text style={[styles.label, { color: colors.text }]}>{person.label}</Text>
          {person.label !== person.id && <Text style={[styles.id, { color: colors.muted }]}>{person.id}</Text>}
        </View>
      </Pressable>

      {confirming ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => setConfirming(false)} hitSlop={8}>
            <Text style={[styles.action, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Confirm removing ${person.label}`} onPress={onRemove} hitSlop={8}>
            <Text style={[styles.action, styles.bold, { color: colors.danger }]}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${person.label} from the roster`}
          onPress={() => setConfirming(true)}
          hitSlop={8}
        >
          <Text style={[styles.action, { color: colors.muted }]}>Remove</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: {
    fontSize: 15,
    fontWeight: "700",
  },
  names: {
    flex: 1,
  },
  label: {
    fontSize: 17,
  },
  id: {
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  action: {
    fontSize: 15,
  },
  bold: {
    fontWeight: "700",
  },
});
