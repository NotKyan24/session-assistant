/**
 * SESSION RESULTS LAYOUT (flow step 4): Setup → Record → Status → **Results**
 *
 * A finished session's results are three pages, switched with tabs at the top:
 *   Notes          "Who's speaking?" (name each voice), then the AI session notes
 *   Participation  how much each person took part, plus AI engagement notes
 *   Transcript     the transcript lines only
 * Routes: /session/<id>/notes, /session/<id>/participation, /session/<id>/transcript.
 *
 * Uses Expo Router's custom tabs (expo-router/ui), which let the tab bar sit
 * above the page. SessionResultsProvider loads the session's data once for all
 * three pages, so switching tabs is instant and names apply everywhere.
 */
import { router, useLocalSearchParams } from "expo-router";
import { TabList, Tabs, TabSlot, TabTrigger } from "expo-router/ui";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { TabButton } from "@/components/tab-button";
import { SessionResultsProvider } from "@/lib/session-results";
import { useColors } from "@/lib/theme";

export default function SessionResultsLayout() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SessionResultsProvider id={id}>
      <Tabs style={styles.tabs}>
        <TabList style={[styles.tabList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TabTrigger name="notes" href={{ pathname: "/session/[id]/notes", params: { id } }} asChild>
            <TabButton>Notes</TabButton>
          </TabTrigger>
          <TabTrigger name="participation" href={{ pathname: "/session/[id]/participation", params: { id } }} asChild>
            <TabButton>Participation</TabButton>
          </TabTrigger>
          <TabTrigger name="transcript" href={{ pathname: "/session/[id]/transcript", params: { id } }} asChild>
            <TabButton>Transcript</TabButton>
          </TabTrigger>
        </TabList>
        <TabSlot />
      </Tabs>
      {/* dismissTo("/") closes every screen back to Setup, for a fresh start. */}
      <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Button title="New session" variant="secondary" onPress={() => router.dismissTo("/")} />
      </View>
    </SessionResultsProvider>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
  },
  tabList: {
    flexDirection: "row",
    gap: 4,
    margin: 12,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
