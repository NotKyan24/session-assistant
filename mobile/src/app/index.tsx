/**
 * SETUP SCREEN (flow step 1 of 4): **Setup** → Record → Status → Transcript
 *
 * This is the app's home screen ("/"). Before anything is recorded, the
 * facilitator:
 * 1. Names the session (pre-filled from today's date, editable).
 * 2. In the one Participants list (the shared roster, loaded from the backend),
 *    marks who's here today, then ticks "Consents" on each of their rows.
 *    People can be added to or removed from the roster here too.
 *
 * Consent is never carried over: once Start succeeds, every consent tick is
 * cleared, so it must be given again for the next session. (Who's here stays
 * marked, since it's often the same group.)
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
import { RosterRow } from "@/components/roster-row";
import { api, isMock, type Person } from "@/lib/api";
import { defaultSessionName } from "@/lib/format";
import { useColors } from "@/lib/theme";

export default function SetupScreen() {
  const colors = useColors();
  // Screen state. React re-draws the screen whenever one of these changes.
  const [name, setName] = useState(defaultSessionName);
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
        participants: inSession.map((p) => ({ ...p, consented: !!consent[p.id] })),
      });
      router.push({ pathname: "/record", params: { id } });
      // This screen stays loaded underneath the session. Clear it now, so the
      // next session starts fresh: consent must be given again every time.
      setConsent({});
      setName(defaultSessionName());
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

      <Text style={[styles.heading, { color: colors.muted }]}>Participants</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {"Tap who's here today, then tick Consents for each of them. Mark only people who will speak: the app looks for exactly that many voices."}
      </Text>
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
              consented={!!consent[p.id]}
              onToggle={() => toggleIncluded(p.id)}
              onToggleConsent={() => setConsent((c) => ({ ...c, [p.id]: !c[p.id] }))}
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

      {roster && (
        <Text style={[styles.note, { color: inSession.length && !missing.length ? colors.success : colors.muted }]}>
          {inSession.length === 0
            ? "Nobody is marked as here yet."
            : missing.length
              ? `Waiting on consent from: ${missing.map((p) => p.label).join(", ")}`
              : `Everyone here has consented (${inSession.length}).`}
        </Text>
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
  hint: {
    fontSize: 14,
    marginTop: -6,
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
