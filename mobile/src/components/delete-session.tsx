/**
 * DELETE SESSION: for when someone withdraws consent, or a session shouldn't be kept.
 *
 * Nothing is deleted on the first tap. On a finished session, "Delete…" asks what to delete:
 *
 *   One person's part   pick the person, read what will happen, then "Remove <name>".
 *                       Their transcript lines are emptied, the recording is deleted
 *                       for everyone (one voice can't be cut out of it), and the
 *                       notes are written again without them; the app shows the
 *                       Status screen while that runs. Every voice must be named
 *                       on the Transcript tab first, or the server refuses.
 *   The whole session   then a reason, which is the confirmation: "Consent withdrawn"
 *                       or "Other reason". The recording, transcript and notes are
 *                       deleted for everyone; the app goes to Past sessions.
 *
 * Without `participants` (e.g. a failed session on the Status screen) only the
 * whole session can be deleted. The server keeps only ids, dates and the reason.
 */
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/button";
import { api, type DeleteReason, type Participant } from "@/lib/api";
import { markSessionsChanged } from "@/lib/sessions-changed";
import { useColors } from "@/lib/theme";

type Phase = "idle" | "choose" | "pick-person" | "confirm-person" | "whole" | "working";

type Props = {
  id: string;
  /** People who can still be removed one by one; omit to offer only whole-session delete. */
  participants?: Participant[];
};

export function DeleteSession({ id, participants }: Props) {
  const colors = useColors();
  const canRemovePerson = !!participants && participants.length > 0;
  const [phase, setPhase] = useState<Phase>("idle");
  const [person, setPerson] = useState<Participant | null>(null);
  const [back, setBack] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  function go(next: Phase) {
    setError(null);
    setPhase(next);
  }

  async function deleteWhole(reason: DeleteReason) {
    setBack("whole");
    go("working");
    try {
      await api.deleteSession(id, reason);
      markSessionsChanged();
      // Back to Past sessions if it's open underneath, otherwise open it in place of this screen.
      router.dismissTo("/sessions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the session.");
      setPhase("whole");
    }
  }

  async function removePerson(p: Participant) {
    setBack("confirm-person");
    go("working");
    try {
      await api.withdrawParticipant(id, p.id);
      markSessionsChanged();
      // The notes are being written again; the Status screen shows progress, then "View results".
      router.replace({ pathname: "/processing", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove them.");
      setPhase("confirm-person");
    }
  }

  if (phase === "idle") {
    return (
      <Button
        title={canRemovePerson ? "Delete…" : "Delete session"}
        variant="secondary"
        onPress={() => go(canRemovePerson ? "choose" : "whole")}
        style={styles.grow}
      />
    );
  }

  const cancel = <Button title="Cancel" variant="secondary" onPress={() => go("idle")} />;

  return (
    <View style={[styles.box, { borderColor: colors.danger }]}>
      {phase === "choose" && (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Delete what?</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            If one person withdrew consent, remove just their part. The rest of the session stays.
          </Text>
          <Button title="One person's part" variant="danger" onPress={() => go("pick-person")} />
          <Button title="The whole session" variant="danger" onPress={() => go("whole")} />
          {cancel}
        </>
      )}

      {phase === "pick-person" && (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Who withdrew consent?</Text>
          {participants?.map((p) => (
            <Button
              key={p.id}
              title={p.label}
              variant="secondary"
              onPress={() => {
                setPerson(p);
                go("confirm-person");
              }}
            />
          ))}
          <Button title="Back" variant="secondary" onPress={() => go("choose")} />
        </>
      )}

      {phase === "confirm-person" && person && (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Remove {person.label} from this session?</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            {"• Their lines are removed from the transcript.\n"}
            {"• The recording is deleted for everyone (one voice can't be cut out of it).\n"}
            {"• The notes are written again without them (about a minute).\n"}
            {"• What others said about them stays: check the transcript afterwards.\n"}
            {"This can't be undone."}
          </Text>
          {error && <Text style={[styles.body, { color: colors.danger }]}>{error}</Text>}
          <Button title={`Remove ${person.label}`} variant="danger" onPress={() => removePerson(person)} />
          <Button title="Back" variant="secondary" onPress={() => go("pick-person")} />
        </>
      )}

      {phase === "whole" && (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Delete this session for everyone?</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            The recording, transcript and notes are deleted from the server and can&apos;t be recovered. Why?
          </Text>
          {error && <Text style={[styles.body, { color: colors.danger }]}>{error}</Text>}
          <Button title="Consent withdrawn" variant="danger" onPress={() => deleteWhole("consent_withdrawn")} />
          <Button title="Other reason" variant="danger" onPress={() => deleteWhole("other")} />
          {canRemovePerson ? <Button title="Back" variant="secondary" onPress={() => go("choose")} /> : cancel}
        </>
      )}

      {phase === "working" && (
        <View style={styles.working}>
          <ActivityIndicator />
          <Text style={[styles.body, { color: colors.muted }]}>
            {back === "whole" ? "Deleting…" : "Removing…"}
          </Text>
        </View>
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
    lineHeight: 21,
  },
  working: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
