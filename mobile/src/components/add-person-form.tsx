/**
 * ADD PERSON FORM: adds someone to the shared roster, on the Setup screen.
 *
 * Two fields: an ID (what the system stores, e.g. "youth-004") and an
 * optional display name (what staff see; it defaults to the ID). The backend
 * checks the ID and rejects duplicates; its message is shown here.
 */
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/button";
import type { Person } from "@/lib/api";
import { useColors } from "@/lib/theme";

type Props = {
  onAdd: (person: Person) => Promise<void>;
  onCancel: () => void;
};

export function AddPersonForm({ onAdd, onCancel }: Props) {
  const colors = useColors();
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setSaving(true);
    setError(null);
    try {
      await onAdd({ id: id.trim(), label: label.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add this person.");
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }];

  return (
    <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Add participant</Text>
      <TextInput
        value={id}
        onChangeText={setId}
        placeholder="ID, e.g. youth-004"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Participant ID"
        style={inputStyle}
      />
      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="Display name (optional)"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Display name"
        style={inputStyle}
      />
      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      <View style={styles.buttons}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.button} />
        <Button title={saving ? "Adding…" : "Add"} onPress={add} disabled={!id.trim() || saving} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    fontSize: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  error: {
    fontSize: 14,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
  },
});
