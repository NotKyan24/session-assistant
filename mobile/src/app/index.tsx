/**
 * SETUP SCREEN (flow step 1 of 4): **Setup** → Record → Status → Transcript
 *
 * This is the app's home screen ("/"). Before anything is recorded, the
 * facilitator:
 * 1. Names the session (pre-filled from today's date, editable).
 * 2. Picks in person or video.
 * 3. Checks a consent box for every participant.
 *
 * Consent rule: **Start** stays disabled until every participant is checked,
 * and a note names who's still missing. The backend enforces the same rule,
 * rejecting a session with any participant who hasn't consented.
 *
 * Pressing Start creates the session through the API, gets back a session id,
 * and opens the Record screen with that id.
 */
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/button";
import { ConsentRow } from "@/components/consent-row";
import { api, isMock, type SessionMode } from "@/lib/api";
import { defaultSessionName } from "@/lib/format";
import { TEST_PARTICIPANTS } from "@/lib/participants";
import { useColors } from "@/lib/theme";

// The two options for the "Where" toggle. `key` is what's sent to the backend.
const MODES: { key: SessionMode; label: string }[] = [
  { key: "in_person", label: "In person" },
  { key: "video", label: "Video" },
];

export default function SetupScreen() {
  const colors = useColors();
  // Screen state. React re-draws the screen whenever one of these changes.
  const [name, setName] = useState(defaultSessionName);
  const [mode, setMode] = useState<SessionMode>("in_person");
  // Consent per participant id, e.g. { "youth-001": true }. Nobody starts checked.
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived on every render: who hasn't consented, and whether Start is allowed.
  const missing = TEST_PARTICIPANTS.filter((p) => !consent[p.id]);
  const canStart = missing.length === 0 && name.trim().length > 0 && !starting;

  // Start button: create the session, then go to the Record screen with its id.
  // We send every participant with their consent flag; the backend checks it again.
  async function start() {
    setStarting(true);
    setError(null);
    try {
      const { id } = await api.createSession({
        name: name.trim(),
        mode,
        participants: TEST_PARTICIPANTS.map((p) => ({ ...p, consented: !!consent[p.id] })),
      });
      router.push({ pathname: "/record", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the session.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Shown only while no backend URL is configured (see src/lib/api.ts). */}
      {isMock && (
        <Text style={[styles.banner, { backgroundColor: colors.surface, color: colors.muted }]}>
          Demo mode: no backend connected. Recordings stay on this phone.
        </Text>
      )}

      <Text style={[styles.heading, { color: colors.muted }]}>Session name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        accessibilityLabel="Session name"
        returnKeyType="done"
      />

      <Text style={[styles.heading, { color: colors.muted }]}>Where</Text>
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Button
            key={m.key}
            title={m.label}
            variant={mode === m.key ? "primary" : "secondary"}
            onPress={() => setMode(m.key)}
            style={styles.modeButton}
          />
        ))}
      </View>

      <Text style={[styles.heading, { color: colors.muted }]}>Participants and consent</Text>
      <View>
        {TEST_PARTICIPANTS.map((p) => (
          <ConsentRow
            key={p.id}
            label={p.label}
            checked={!!consent[p.id]}
            onToggle={() => setConsent((c) => ({ ...c, [p.id]: !c[p.id] }))}
          />
        ))}
      </View>

      <Text style={[styles.note, { color: missing.length ? colors.muted : colors.success }]}>
        {missing.length
          ? `Waiting on consent from: ${missing.map((p) => p.label).join(", ")}`
          : "Everyone has consented."}
      </Text>

      {error && <Text style={[styles.note, { color: colors.danger }]}>{error}</Text>}

      <Button title={starting ? "Starting…" : "Start"} onPress={start} disabled={!canStart} size="large" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  banner: {
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
  },
  heading: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 17,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  modeRow: {
    flexDirection: "row",
    gap: 12,
  },
  modeButton: {
    flex: 1,
  },
  note: {
    fontSize: 15,
    marginVertical: 4,
  },
});
