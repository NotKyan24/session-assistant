/**
 * PARTICIPATION CARD: the measured participation numbers, on the
 * Participation page. These come from the transcript (backend/metrics.py),
 * not from AI:
 * - Session: length and how much of it was silence.
 * - Per person (and "Unknown" for speech the speaker model couldn't place):
 *   share of all speaking time (the bar), speaking time, words and words per
 *   minute, and questions asked.
 * - Who responds to whom: how often each person spoke right after another.
 */
import { StyleSheet, Text, View } from "react-native";

import type { Metrics } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { useColors } from "@/lib/theme";

type Props = {
  metrics: Metrics;
  displayName: (speaker: string) => string;
  colorFor: (speaker: string) => string;
};

export function ParticipationCard({ metrics, displayName, colorFor }: Props) {
  const colors = useColors();
  const { session, speakers, interactions } = metrics;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.text }]}>Participation</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>
          Session {formatClock(session.length_seconds)} · {session.silence_percent}% silence
        </Text>

        {speakers.map((s) => (
          <View
            key={s.speaker}
            style={styles.person}
            accessibilityLabel={`${displayName(s.speaker)}: ${s.percent} percent of speaking time, ${s.words} words, ${s.questions} questions`}
          >
            <View style={styles.personTop}>
              <View style={[styles.dot, { backgroundColor: colorFor(s.speaker) }]} />
              <Text style={[styles.name, { color: colors.text }]}>{displayName(s.speaker)}</Text>
              <Text style={[styles.percent, { color: colors.text }]}>{s.percent}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { width: `${s.percent}%`, backgroundColor: colorFor(s.speaker) }]} />
            </View>
            <Text style={[styles.muted, { color: colors.muted }]}>
              {formatClock(s.speaking_seconds)} speaking · {s.words.toLocaleString()} words ({s.words_per_minute}/min) ·{" "}
              {s.questions} {s.questions === 1 ? "question" : "questions"}
            </Text>
          </View>
        ))}
      </View>

      {interactions.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.text }]}>Who responds to whom</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>How often each person spoke right after another.</Text>
          {interactions.map((i) => (
            <View key={`${i.from}-${i.to}`} style={styles.interaction}>
              <Text style={[styles.body, { color: colors.text }]}>
                <Text style={{ color: colorFor(i.to), fontWeight: "700" }}>{displayName(i.to)}</Text>
                {" responded to "}
                <Text style={{ color: colorFor(i.from), fontWeight: "700" }}>{displayName(i.from)}</Text>
              </Text>
              <Text style={[styles.count, { color: colors.text }]}>{i.count}×</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.muted, { color: colors.muted }]}>
        Measured from the transcript, so the numbers depend on each voice being identified and named correctly.
        Questions are counted from punctuation. Speaking time shows how much someone spoke, not how engaged they were.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    fontSize: 15,
    flex: 1,
  },
  person: {
    gap: 6,
    marginTop: 6,
  },
  personTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  percent: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
  interaction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  count: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
