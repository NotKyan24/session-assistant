/**
 * ROOT LAYOUT: the app's navigator.
 *
 * Expo Router turns every file in src/app/ into a screen, named after the file:
 *   index.tsx → "/" (Setup) · record.tsx → "/record" · status.tsx → "/status"
 *   transcript.tsx → "/transcript"
 * This file wraps them in a Stack: each new screen slides in on top of the
 * last, with a header bar and a back button.
 *
 * Status and Transcript hide the back button and swipe-back gesture. Once
 * audio is uploaded, going "back" to the recorder makes no sense; the way
 * out is the "New session" button.
 */
import { Stack } from "expo-router";

import { useColors } from "@/lib/theme";

export default function RootLayout() {
  // Light or dark colors, following the phone's appearance setting.
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "New session" }} />
      <Stack.Screen name="record" options={{ title: "Record" }} />
      <Stack.Screen name="status" options={{ title: "Processing", headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="transcript" options={{ title: "Transcript", headerBackVisible: false, gestureEnabled: false }} />
    </Stack>
  );
}
