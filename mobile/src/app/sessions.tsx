/**
 * PAST SESSIONS SCREEN ("/sessions"): look back at earlier sessions.
 *
 * Opened from the "Past sessions" button on the Setup screen. Lists sessions
 * newest first, 30 at a time (more load as you scroll), with a search box
 * that matches the session name and participant names (not the transcript).
 *
 * Tapping a session opens:
 *   - Ready → its results (Notes · Participation · Transcript)
 *   - Processing or Failed → the Status screen
 *
 * Test sessions (from the smoke test) and sessions never recorded are hidden
 * unless "Show test and unrecorded sessions" is on. Nothing is deleted.
 * Pull down to refresh.
 */
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { SessionRow } from "@/components/session-row";
import { api, type SessionListItem } from "@/lib/api";
import { useColors } from "@/lib/theme";

// Wait this long after the last keystroke before searching.
const SEARCH_DELAY_MS = 300;

export default function PastSessionsScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [items, setItems] = useState<SessionListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ignores replies to older searches that arrive after a newer one.
  const requestId = useRef(0);

  async function load(reset: boolean) {
    const mine = ++requestId.current;
    setError(null);
    try {
      const offset = reset ? 0 : (items?.length ?? 0);
      const page = await api.listSessions({ q: query, includeHidden, offset });
      if (mine !== requestId.current) return;
      setItems((current) => (reset ? page.sessions : [...(current ?? []), ...page.sessions]));
      setTotal(page.total);
      setHasMore(page.has_more);
    } catch (e) {
      if (mine === requestId.current) setError(e instanceof Error ? e.message : "Could not load past sessions.");
    }
  }

  // Reload from the top when the search or the toggle changes (search waits for a pause in typing).
  useEffect(() => {
    const timer = setTimeout(() => load(true), query ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, includeHidden]);

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  }

  function open(session: SessionListItem) {
    if (session.status === "ready") {
      router.push({ pathname: "/session/[id]/notes", params: { id: session.id } });
    } else {
      router.push({ pathname: "/processing", params: { id: session.id } });
    }
  }

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by session or participant name"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search past sessions"
            style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
          {items && (
            <Text style={[styles.count, { color: colors.muted }]}>
              {total} {total === 1 ? "session" : "sessions"}
              {query ? ` matching "${query}"` : ""}
            </Text>
          )}
          {error && <Text style={[styles.count, { color: colors.danger }]}>{error}</Text>}
        </View>
      }
      renderItem={({ item }) => <SessionRow session={item} onPress={() => open(item)} />}
      ListEmptyComponent={
        items === null && !error ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <Text style={[styles.empty, { color: colors.muted }]}>
            {query ? "No sessions match that search." : "No sessions yet. Recorded sessions will show up here."}
          </Text>
        )
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {loadingMore && <ActivityIndicator />}
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: includeHidden }}
            onPress={() => setIncludeHidden((v) => !v)}
            hitSlop={8}
          >
            <Text style={[styles.toggle, { color: colors.primary }]}>
              {includeHidden ? "Hide test and unrecorded sessions" : "Show test and unrecorded sessions"}
            </Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    gap: 8,
    marginBottom: 4,
  },
  search: {
    fontSize: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  count: {
    fontSize: 13,
  },
  loading: {
    marginTop: 32,
  },
  empty: {
    fontSize: 15,
    marginTop: 24,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 24,
  },
  toggle: {
    fontSize: 14,
    fontWeight: "600",
  },
});
