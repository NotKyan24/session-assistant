/**
 * STATUS SCREEN (flow step 3 of 4): Setup → Record → **Status** → Transcript
 *
 * After the upload, the backend works through the audio in stages:
 *   Uploading → Converting → Transcribing → Aligning → Identifying speakers → Ready
 * This screen asks the backend "where are you?" every 3 seconds (polling) and
 * highlights the current stage.
 *
 * - Ready: shows a "View transcript" button.
 * - Failed: shows which stage failed and the error message, plus "New session".
 * - Network trouble: shows a note and keeps trying.
 * Polling stops on ready or failed, and when the user leaves the screen.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { Button } from "@/components/button";
import { STAGES, StageList } from "@/components/stage-list";
import { api, type SessionStatus } from "@/lib/api";
import { useColors } from "@/lib/theme";

// How often to ask the backend for an update.
const POLL_MS = 3000;

export default function StatusScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  // The polling loop. `active` turns false when the screen closes, so a reply
  // that arrives late is ignored and no new request is scheduled.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const next = await api.getSession(id);
        if (!active) return;
        setSession(next);
        setPollError(null);
        // Finished either way: stop polling.
        if (next.status === "ready" || next.status === "failed") return;
      } catch (e) {
        if (!active) return;
        setPollError(e instanceof Error ? e.message : "Can't reach the server.");
      }
      // Not finished (or the request failed): try again in 3 seconds.
      timer = setTimeout(poll, POLL_MS);
    }

    poll();
    // Stop polling when the screen closes.
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  // For the failure message, e.g. "Converting failed."
  const failed = session?.status === "failed";
  const failedLabel = STAGES.find((s) => s.key === session?.failed_stage)?.label;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {session && <Text style={[styles.title, { color: colors.text }]}>{session.name}</Text>}

      <StageList current={session?.stage ?? "uploaded"} failedAt={failed ? (session?.failed_stage ?? "converting") : undefined} />

      {pollError && (
        <Text style={[styles.body, { color: colors.danger }]}>Still trying to reach the server: {pollError}</Text>
      )}

      {failed && (
        <Text style={[styles.body, { color: colors.danger }]}>
          {failedLabel ? `${failedLabel} failed. ` : ""}
          {session?.error ?? "Something went wrong."}
        </Text>
      )}

      {/* Non-fatal problems, e.g. speakers couldn't be identified (transcript still works). */}
      {session?.warnings?.map((w) => (
        <Text key={w} style={[styles.body, { color: colors.muted }]}>
          {w}
        </Text>
      ))}

      {session?.status === "ready" && (
        <Button title="View transcript" size="large" onPress={() => router.replace({ pathname: "/transcript", params: { id } })} />
      )}
      {/* dismissTo("/") closes every screen back to Setup, for a fresh start. */}
      {failed && <Button title="New session" variant="secondary" onPress={() => router.dismissTo("/")} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  body: {
    fontSize: 16,
  },
});
