/**
 * ROSTER ROW: one person in the Participants list on the Setup screen.
 *
 * - Tapping the row (the left checkbox and name) marks them as here today.
 * - Once they're here, a "Consents" checkbox appears on the right. Start stays
 *   disabled until everyone marked here has consented.
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
  consented: boolean;
  onToggle: () => void;
  onToggleConsent: () => void;
  onRemove: () => void;
};

export function RosterRow({ person, included, consented, onToggle, onToggleConsent, onRemove }: Props) {
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

      {included && !confirming && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consented }}
          accessibilityLabel={`${person.label} consents to recording`}
          onPress={onToggleConsent}
          hitSlop={6}
          style={styles.consent}
        >
          <Text style={[styles.consentLabel, { color: consented ? colors.success : colors.muted }]}>Consents</Text>
          <View
            style={[
              styles.box,
              {
                borderColor: consented ? colors.success : colors.border,
                backgroundColor: consented ? colors.success : "transparent",
              },
            ]}
          >
            {consented && <Text style={[styles.tick, { color: colors.onPrimary }]}>✓</Text>}
          </View>
        </Pressable>
      )}

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
  consent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  consentLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
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
