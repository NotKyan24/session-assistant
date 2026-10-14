"""
SUMMARIZER: the only file that talks to the summary model.

The rest of the backend calls one function:

    summarize(segments) -> notes

`segments` is the transcript from transcribe.py. `notes` is a dict of
structured session notes:

    {
      "overview": "Two or three sentences on what the session covered.",
      "sections": [
        {"title": "Topics discussed",    "items": ["...", "..."]},
        {"title": "Concerns raised",     "items": [...]},
        {"title": "Goals / next steps",  "items": [...]},
        {"title": "Follow-ups",          "items": [...]}
      ],
      "model": "<model name>",
      "created_at": "2026-10-14T18:00:00Z"
    }

To change the headings, edit SECTIONS below. The app shows whatever sections
come back, so it doesn't need to change.

How it works:
1. The transcript is turned into plain lines, "[mm:ss] Speaker 1: text".
2. It is sent with instructions (PROMPT) to Purple Maia's model server
   (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env). The server speaks the
   standard OpenAI "chat completions" format, so any model on it can be used
   by changing LLM_MODEL.
3. The model answers in JSON. We clean that up and check it has the right shape.

Privacy: this is the one place transcript text leaves the Mac. It goes only to
Purple's server, over HTTPS, and only to Purple-controlled models (never
"cloud-..." ones; see AGENTS.md). Nothing here logs the transcript or the
notes. Errors are reported without the text.
"""

import config  # noqa: F401  (loads .env)

import json
import logging
import re
import time

import requests

import sessions

log = logging.getLogger("session_assistant.summarize")

# The note headings, in order. `key` is what the model fills in; `title` is shown in the app.
SECTIONS = [
    {"key": "topics_discussed", "title": "Topics discussed", "hint": "main subjects talked about"},
    {"key": "concerns_raised", "title": "Concerns raised", "hint": "worries, problems or risks anyone mentioned"},
    {"key": "goals_next_steps", "title": "Goals / next steps", "hint": "goals set or actions agreed"},
    {"key": "follow_ups", "title": "Follow-ups", "hint": "things to check on or bring up next session"},
]

PROMPT = """You write session notes for staff at a youth-serving nonprofit, based on a transcript of a counseling or group session.

The transcript lines look like "[mm:ss] Speaker 1: text". Speaker labels are automatic and may be imperfect. The transcription is automatic too, so names and Hawaiian or Pidgin words may be misspelled.

Rules:
- Use only what is in the transcript. Never invent facts, names, diagnoses or advice.
- Refer to people by their speaker label (e.g. "Speaker 2"), never guess real names.
- Be brief and neutral: short bullet items, plain language.
- If a section has nothing, return an empty list for it.
- Write in English.

Return ONLY a JSON object, with no other text, in exactly this shape:
{
  "overview": "2-3 sentences on what the session covered",
%s
}"""


class SummaryError(Exception):
    """Summarizing failed; the message is safe to show the user."""


def is_configured() -> bool:
    return bool(config.LLM_BASE_URL and config.LLM_API_KEY and config.LLM_MODEL)


def _clock(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 60:02d}:{s % 60:02d}"


def _speaker(label: str) -> str:
    """SPEAKER_00 -> Speaker 1, the same names the app shows."""
    match = re.fullmatch(r"SPEAKER_(\d+)", label)
    return f"Speaker {int(match.group(1)) + 1}" if match else label


def _transcript_text(segments: list[dict]) -> str:
    return "\n".join(f"[{_clock(s['start'])}] {_speaker(s['speaker'])}: {s['text']}" for s in segments)


def _system_prompt() -> str:
    fields = ",\n".join(f'  "{s["key"]}": ["{s["hint"]}", ...]' for s in SECTIONS)
    return PROMPT % fields


def _extract_json(content: str) -> dict:
    """Pull the JSON object out of the model's reply.

    Some models wrap it in ```json fences or add "thinking" text before it,
    so take the part from the first "{" to the last "}".
    """
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end <= start:
        raise SummaryError("The summary model didn't return notes in the expected format.")
    try:
        return json.loads(content[start : end + 1])
    except json.JSONDecodeError as exc:
        raise SummaryError("The summary model didn't return notes in the expected format.") from exc


def _clean_items(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def summarize(segments: list[dict]) -> dict:
    """Turn transcript segments into structured session notes (see the top of this file)."""
    if not is_configured():
        raise SummaryError("Summaries aren't set up on the server (LLM_BASE_URL / LLM_API_KEY missing).")
    if not segments:
        raise SummaryError("There's no speech to summarize.")

    started = time.monotonic()
    try:
        response = requests.post(
            f"{config.LLM_BASE_URL.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {config.LLM_API_KEY}"},
            json={
                "model": config.LLM_MODEL,
                "temperature": 0.2,  # Low: stick to the transcript, little creativity.
                "max_tokens": config.LLM_MAX_TOKENS,
                "messages": [
                    {"role": "system", "content": _system_prompt()},
                    {"role": "user", "content": _transcript_text(segments)},
                ],
            },
            timeout=config.LLM_TIMEOUT_SECONDS,
        )
    except requests.Timeout as exc:
        raise SummaryError("The summary model took too long to answer.") from exc
    except requests.RequestException as exc:
        log.warning("Summary request failed: %s", type(exc).__name__)
        raise SummaryError("Couldn't reach the summary model server.") from exc

    if not response.ok:
        # The error body describes the server problem, not the transcript; log only its start.
        log.warning("Summary model returned HTTP %s: %s", response.status_code, response.text[:200])
        raise SummaryError(f"The summary model server returned an error (HTTP {response.status_code}).")

    try:
        content = response.json()["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise SummaryError("The summary model server sent an unexpected reply.") from exc

    raw = _extract_json(content)
    notes = {
        "overview": str(raw.get("overview") or "").strip(),
        "sections": [{"title": s["title"], "items": _clean_items(raw.get(s["key"]))} for s in SECTIONS],
        "model": config.LLM_MODEL,
        "created_at": sessions.now_iso(),
    }
    log.info("Summary written in %.1fs", time.monotonic() - started)
    return notes
