/**
 * SESSION RESULTS LAYOUT (flow step 4): Setup → Record → Status → **Results**
 *
 * A finished session's results are three pages, switched with tabs at the top:
 *   Notes          the AI session notes
 *   Participation  how much each person took part, plus AI engagement notes
 *   Transcript     "Who's speaking?" (name each voice), then the transcript lines
 * Below them: "New session" and "Delete…" (one person's part, or the whole
 * session; see delete-session.tsx).
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
import { DeleteSession } from "@/components/delete-session";
import { TabButton } from "@/components/tab-button";
import { SessionResultsProvider, useSessionResults } from "@/lib/session-results";
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
        {/* The slot must fill the space left under the tab bar (flex: 1, and allowed
            to shrink below its content with minHeight: 0). Otherwise each page grows
            to its full content height, can't scroll, and the bottom is cut off:
            the transcript showed only its first 10 lines. */}
        <TabSlot style={styles.slot} />
      </Tabs>
      <Footer id={id} />
    </SessionResultsProvider>
  );
}

// Inside the provider, so Delete… can offer to remove one person from the session.
function Footer({ id }: { id: string }) {
  const colors = useColors();
  const { activeParticipants } = useSessionResults();
  return (
    <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.background }]}>
      {/* dismissTo("/") closes every screen back to Setup, for a fresh start. */}
      <Button title="New session" variant="secondary" onPress={() => router.dismissTo("/")} style={styles.grow} />
      <DeleteSession id={id} participants={activeParticipants} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    minHeight: 0,
  },
  tabs: {
    flex: 1,
    minHeight: 0,
  },
  tabList: {
    flexDirection: "row",
    gap: 4,
    margin: 12,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  grow: {
    flexGrow: 1,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
