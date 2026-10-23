/**
 * SETUP SCREEN (flow step 1 of 4): **Setup** → Record → Status → Transcript
 *
 * This is the app's home screen ("/"). Before anything is recorded, the
 * facilitator:
 * 1. Names the session (pre-filled from today's date, editable).
 * 2. Picks in person or video.
 * 3. Picks who's here today from the shared roster (loaded from the backend).
 *    People can be added to or removed from the roster here too.
 * 4. Checks a consent box for every person in today's session.
 *
 * Consent rule: **Start** stays disabled until at least one person is in the
 * session and every one of them has consented, and a note names who's still
 * missing. The backend enforces the same rule.
 *
 * Pressing Start creates the session through the API, gets back a session id,
 * and opens the Record screen with that id. "Past sessions" (top right) opens
 * the list of earlier sessions.
 */
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AddPersonForm } from "@/components/add-person-form";
import { Button } from "@/components/button";
import { ConsentRow } from "@/components/consent-row";
import { RosterRow } from "@/components/roster-row";
import { api, isMock, type Person, type SessionMode } from "@/lib/api";
import { defaultSessionName } from "@/lib/format";
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
  // The shared roster; null while it loads.
  const [roster, setRoster] = useState<Person[] | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Who's in today's session, and their consent, by participant id. Nobody starts checked.
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the roster once when the screen opens.
  useEffect(() => {
    api.getRoster().then(setRoster, (e) => setRosterError(e instanceof Error ? e.message : "Could not load the roster."));
  }, []);

  // Derived on every render: today's people, who hasn't consented, and whether Start is allowed.
  const inSession = (roster ?? []).filter((p) => included[p.id]);
  const missing = inSession.filter((p) => !consent[p.id]);
  const canStart = inSession.length > 0 && missing.length === 0 && name.trim().length > 0 && !starting;

  function toggleIncluded(id: string) {
    setIncluded((c) => ({ ...c, [id]: !c[id] }));
    // Taking someone out of today's session also clears their consent tick.
    setConsent((c) => ({ ...c, [id]: false }));
  }

  async function addPerson(person: Person) {
    const added = await api.addPerson(person);
    setRoster((r) => [...(r ?? []), added]);
    setIncluded((c) => ({ ...c, [added.id]: true }));
    setAdding(false);
  }

  async function removePerson(id: string) {
    try {
      await api.removePerson(id);
      setRoster((r) => (r ?? []).filter((p) => p.id !== id));
      setIncluded((c) => ({ ...c, [id]: false }));
      setConsent((c) => ({ ...c, [id]: false }));
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : "Could not remove this person.");
    }
  }

  // Start button: create the session, then go to the Record screen with its id.
  // We send every participant with their consent flag; the backend checks it again.
  async function start() {
    setStarting(true);
    setError(null);
    try {
      const { id } = await api.createSession({
        name: name.trim(),
        mode,
        participants: inSession.map((p) => ({ ...p, consented: !!consent[p.id] })),
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
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => router.push("/sessions")} hitSlop={8}>
              <Text style={[styles.headerLink, { color: colors.primary }]}>Past sessions</Text>
            </Pressable>
          ),
        }}
      />
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

      <Text style={[styles.heading, { color: colors.muted }]}>{"Who's here today"}</Text>
      {roster === null && !rosterError && <ActivityIndicator />}
      {rosterError && <Text style={[styles.note, { color: colors.danger }]}>{rosterError}</Text>}
      {roster && (
        <View>
          {roster.length === 0 && (
            <Text style={[styles.note, { color: colors.muted }]}>The roster is empty. Add the people in this session.</Text>
          )}
          {roster.map((p) => (
            <RosterRow
              key={p.id}
              person={p}
              included={!!included[p.id]}
              onToggle={() => toggleIncluded(p.id)}
              onRemove={() => removePerson(p.id)}
            />
          ))}
        </View>
      )}
      {roster &&
        (adding ? (
          <AddPersonForm onAdd={addPerson} onCancel={() => setAdding(false)} />
        ) : (
          <Button title="+ Add participant" variant="secondary" onPress={() => setAdding(true)} />
        ))}

      <Text style={[styles.heading, { color: colors.muted }]}>Consent</Text>
      {inSession.length === 0 ? (
        <Text style={[styles.note, { color: colors.muted }]}>{"Choose who's here today, above."}</Text>
      ) : (
        <>
          <View>
            {inSession.map((p) => (
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
        </>
      )}

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
  headerLink: {
    fontSize: 16,
    fontWeight: "600",
  },
});
