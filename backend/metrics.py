"""
PARTICIPATION METRICS: how much each person took part, computed exactly from
the transcript (no AI involved).

One function:

    participation(segments) -> metrics

`segments` is the transcript ({speaker, start, end, text}, in time order).
The result:

    {
      "session": {"length_seconds", "speaking_seconds", "silence_percent"},
      "speakers": [            # most speaking time first, "Unknown" last
        {"speaker", "speaking_seconds", "percent", "words",
         "words_per_minute", "questions"}
      ],
      "interactions": [        # who spoke right after whom, most frequent first
        {"from", "to", "count"}
      ]
    }

Definitions:
- percent: this speaker's share of all speaking time (everyone, including
  Unknown, adds up to 100).
- questions: sentences ending in "?", so it depends on Whisper's punctuation.
- interactions: each time the speaker changes from A to B counts once as
  "B responded to A". Several segments in a row from one person are one turn.
- length_seconds: up to the end of the last speech (trailing silence after the
  last word isn't counted, since the transcript can't see it).

The numbers are only as good as the speaker identification: a sentence
credited to the wrong voice shifts both people's numbers.
"""

UNKNOWN = "Unknown"


def participation(segments: list[dict]) -> dict:
    per_speaker: dict[str, dict] = {}
    interactions: dict[tuple[str, str], int] = {}
    previous_speaker = None

    for seg in segments:
        speaker = seg["speaker"]
        stats = per_speaker.setdefault(speaker, {"speaking_seconds": 0.0, "words": 0, "questions": 0})
        stats["speaking_seconds"] += max(0.0, seg["end"] - seg["start"])
        stats["words"] += len(seg["text"].split())
        stats["questions"] += seg["text"].count("?")

        if previous_speaker is not None and speaker != previous_speaker:
            key = (previous_speaker, speaker)
            interactions[key] = interactions.get(key, 0) + 1
        previous_speaker = speaker

    total_speaking = sum(s["speaking_seconds"] for s in per_speaker.values())
    length = max((seg["end"] for seg in segments), default=0.0)

    speakers = []
    for speaker, stats in per_speaker.items():
        seconds = stats["speaking_seconds"]
        speakers.append(
            {
                "speaker": speaker,
                "speaking_seconds": round(seconds, 1),
                "percent": round(100 * seconds / total_speaking, 1) if total_speaking else 0.0,
                "words": stats["words"],
                "words_per_minute": round(stats["words"] / (seconds / 60)) if seconds else 0,
                "questions": stats["questions"],
            }
        )
    speakers.sort(key=lambda s: (s["speaker"] == UNKNOWN, -s["speaking_seconds"]))

    return {
        "session": {
            "length_seconds": round(length, 1),
            "speaking_seconds": round(total_speaking, 1),
            "silence_percent": round(100 * max(0.0, length - total_speaking) / length, 1) if length else 0.0,
        },
        "speakers": speakers,
        "interactions": [
            {"from": a, "to": b, "count": n}
            for (a, b), n in sorted(interactions.items(), key=lambda item: -item[1])
        ],
    }
