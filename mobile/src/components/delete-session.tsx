/**
 * DELETE SESSION: removes a session for good, e.g. when someone withdraws consent.
 *
 * Deleting takes two taps, like Remove on the roster: "Delete session" first,
 * then a reason, which is the confirmation:
 *   - "Consent withdrawn"
 *   - "Other reason"
 *   - "Cancel" goes back.
 * The server deletes the recording, transcript and notes for everyone in the
 * session, and keeps only the session id, dates and reason (no names, no
 * content). Afterwards the app goes to Past sessions.
 */
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/button";
import { api, type DeleteReason } from "@/lib/api";
import { markSessionsChanged } from "@/lib/sessions-changed";
import { useColors } from "@/lib/theme";

export function DeleteSession({ id }: { id: string }) {
  const colors = useColors();
  const [phase, setPhase] = useState<"idle" | "confirming" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function remove(reason: DeleteReason) {
    setPhase("deleting");
    setError(null);
    try {
      await api.deleteSession(id, reason);
      markSessionsChanged();
      // Back to Past sessions if it's open underneath, otherwise open it in place of this screen.
      router.dismissTo("/sessions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the session.");
      setPhase("confirming");
    }
  }

  if (phase === "idle") {
    return <Button title="Delete session" variant="secondary" onPress={() => setPhase("confirming")} style={styles.grow} />;
  }

  return (
    <View style={[styles.box, { borderColor: colors.danger }]}>
      <Text style={[styles.title, { color: colors.text }]}>Delete this session for everyone?</Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        The recording, transcript and notes are deleted from the server and can&apos;t be recovered. Why?
      </Text>
      {error && <Text style={[styles.body, { color: colors.danger }]}>{error}</Text>}
      {phase === "deleting" ? (
        <ActivityIndicator />
      ) : (
        <>
          <Button title="Consent withdrawn" variant="danger" onPress={() => remove("consent_withdrawn")} />
          <Button title="Other reason" variant="danger" onPress={() => remove("other")} />
          <Button title="Cancel" variant="secondary" onPress={() => setPhase("idle")} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: {
    flexGrow: 1,
  },
  box: {
    width: "100%",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  body: {
    fontSize: 15,
  },
});
