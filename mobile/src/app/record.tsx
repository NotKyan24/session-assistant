/**
 * RECORD SCREEN (flow step 2 of 4): Setup → **Record** → Status → Transcript
 *
 * Captures the session audio on the phone, or lets the user pick an existing
 * audio file instead, then uploads it and moves on to the Status screen.
 *
 * How it works:
 * - `expo-audio` does the recording. `useAudioRecorder` creates a recorder
 *   object (record / pause / stop), and `useAudioRecorderState` re-reads its
 *   state every 100 ms so the timer and level meter stay live.
 * - `expo-keep-awake` stops the phone from locking mid-recording. In Expo Go,
 *   a locked screen would stop the recording (background audio needs a
 *   development build, which is out of scope for Day 1).
 * - `expo-document-picker` opens the system file picker for "Choose a file".
 * - The upload goes through `api.uploadAudio`, which is the simulated backend
 *   until EXPO_PUBLIC_API_URL is set (see src/lib/api.ts).
 *
 * The screen moves through four phases:
 *   idle ──Record──▶ recording ⇄ paused (Pause / Resume)
 *     │                 │
 *     └─Choose a file   └──Stop and upload──▶ uploading ──▶ Status screen
 * If the upload fails, it goes back to idle and shows the error.
 */
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/button";
import { LevelMeter } from "@/components/level-meter";
import { api, type AudioFile } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { useColors } from "@/lib/theme";

// Names our keep-awake request, so we release exactly the one we turned on.
const KEEP_AWAKE_TAG = "recording";

// Start from Expo's HIGH_QUALITY preset (AAC in an .m4a file, 44.1 kHz) and change three things:
// - Mono: plenty for speech; WhisperX converts to mono anyway.
// - 64 kbps instead of 128: still clear for speech (WhisperX reduces audio to
//   16 kHz anyway) and about 29 MB per hour, so multi-hour sessions stay small to upload.
// - Metering on: the recorder reports a live loudness value, which drives the level meter.
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
};

// Lets the screen sleep again. It errors if keep-awake was never turned on
// (e.g. the user leaves before recording), which is fine, so we ignore that error.
function releaseKeepAwake() {
  deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
}

// Where the screen is in the recording flow (see the diagram at the top).
type Phase = "idle" | "recording" | "paused" | "uploading";
// Microphone permission: "checking" until the user answers the system prompt.
type Permission = "checking" | "granted" | "denied";

export default function RecordScreen() {
  const colors = useColors();
  // The session id from the Setup screen, passed in the route: /record?id=...
  const { id } = useLocalSearchParams<{ id: string }>();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);

  const [permission, setPermission] = useState<Permission>("checking");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  // 0-1 while a file is being sent, for "Uploading… 45%".
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Runs once when the screen opens: ask for the microphone, then tell iOS we
  // intend to record (and to keep working even if the silent switch is on).
  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermission(granted ? "granted" : "denied");
      if (granted) {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      }
    })();
    // Cleanup when the screen closes: never leave the phone stuck awake.
    return releaseKeepAwake;
  }, []);

  // Record button: get the recorder ready, start capturing, keep the screen on.
  async function startRecording() {
    setError(null);
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      setPhase("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recording.");
    }
  }

  // Pausing stops the clock too: durationMillis only counts recorded time.
  function pause() {
    recorder.pause();
    setPhase("paused");
  }

  // Calling record() again continues the same file rather than starting a new one.
  function resume() {
    recorder.record();
    setPhase("recording");
  }

  // Stop: finish the file, let the screen sleep, then upload what was recorded.
  // recorder.uri is where expo-audio saved the .m4a on the phone.
  async function stopAndUpload() {
    await recorder.stop();
    releaseKeepAwake();
    if (!recorder.uri) {
      setError("The recording could not be saved. Please try again.");
      setPhase("idle");
      return;
    }
    // Phones record .m4a (the MP4 container, so audio/mp4). The web build records
    // with the browser's MediaRecorder, which gives .webm. The backend converts either.
    const file =
      Platform.OS === "web"
        ? { uri: recorder.uri, name: `${id}.webm`, mimeType: "audio/webm" }
        : { uri: recorder.uri, name: `${id}.m4a`, mimeType: "audio/mp4" };
    await upload(file);
  }

  // "Choose a file instead": open the system picker, limited to audio files.
  // copyToCacheDirectory makes a readable copy so the upload can access it.
  async function chooseFile() {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    await upload({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "audio/mpeg" });
  }

  // Shared by both paths (recording and picked file). On success, replace this
  // screen with Status, so "back" can't return to a finished recording.
  async function upload(file: AudioFile) {
    setPhase("uploading");
    setUploadProgress(0);
    try {
      await api.uploadAudio(id, file, setUploadProgress);
      router.replace({ pathname: "/processing", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed.");
      setPhase("idle");
    }
  }

  // While recording, paused or uploading, block navigating away (below).
  const busy = phase !== "idle";
  const seconds = recorderState.durationMillis / 1000;

  // Mic refused: explain, and still offer the file picker as a way forward.
  if (permission === "denied") {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>Microphone access is off</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Session Assistant needs the microphone to record. Turn it on in Settings, then come back. You can still
          choose an existing recording.
        </Text>
        <Button title="Choose a file instead" variant="secondary" onPress={chooseFile} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Block going back while a recording is in progress. */}
      <Stack.Screen options={{ headerBackVisible: !busy, gestureEnabled: !busy }} />

      <Text
        style={[styles.timer, { color: phase === "paused" ? colors.muted : colors.text }]}
        accessibilityLabel={`Recorded ${formatClock(seconds)}`}
      >
        {formatClock(seconds)}
      </Text>
      <Text style={[styles.body, styles.center, { color: colors.muted }]}>
        {phase === "recording"
          ? "Recording"
          : phase === "paused"
            ? "Paused"
            : phase === "uploading"
              ? `Uploading… ${Math.floor((uploadProgress ?? 0) * 100)}%`
              : permission === "checking"
                ? "Waiting for microphone permission…"
                : "Ready to record"}
      </Text>

      <LevelMeter db={recorderState.metering} active={phase === "recording"} />

      {/* Which buttons show depends on the phase: Record → Pause/Resume + Stop → spinner. */}
      <View style={styles.controls}>
        {phase === "idle" && (
          <Button title="Record" size="large" variant="danger" onPress={startRecording} disabled={permission !== "granted"} />
        )}
        {(phase === "recording" || phase === "paused") && (
          <>
            {phase === "recording" ? (
              <Button title="Pause" size="large" variant="secondary" onPress={pause} />
            ) : (
              <Button title="Resume" size="large" onPress={resume} />
            )}
            <Button title="Stop and upload" size="large" variant="danger" onPress={stopAndUpload} />
          </>
        )}
        {phase === "uploading" && <ActivityIndicator size="large" />}
      </View>

      {error && <Text style={[styles.body, { color: colors.danger }]}>{error}</Text>}

      {phase === "idle" && (
        <Button title="Choose a file instead" variant="secondary" onPress={chooseFile} style={styles.chooseFile} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  timer: {
    marginTop: 24,
    fontSize: 64,
    fontWeight: "300",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  body: {
    fontSize: 16,
  },
  center: {
    textAlign: "center",
  },
  controls: {
    marginTop: 16,
    gap: 12,
  },
  chooseFile: {
    marginTop: "auto",
  },
});
