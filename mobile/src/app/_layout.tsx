/**
 * ROOT LAYOUT: the app's navigator.
 *
 * Expo Router turns every file in src/app/ into a screen, named after the file:
 *   index.tsx → "/" (Setup) · record.tsx → "/record" · processing.tsx → "/processing" (Status)
 *   session/[id]/ → "/session/<id>/notes" | "/participation" | "/transcript" (Results, as tabs)
 *   sessions.tsx → "/sessions" (Past sessions)
 * This file wraps them in a Stack: each new screen slides in on top of the
 * last, with a header bar and a back button.
 *
 * After a recording, Record is replaced by Status and Status by Results, so
 * "back" from either returns to Setup (never to a finished recording). Opened
 * from Past sessions, "back" returns to the list.
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
      <Stack.Screen name="processing" options={{ title: "Processing" }} />
      <Stack.Screen name="session/[id]" options={{ title: "Session results" }} />
      <Stack.Screen name="sessions" options={{ title: "Past sessions" }} />
    </Stack>
  );
}
