"""
SESSION STORAGE: one JSON file per session, no database.

Files, all in data/sessions/ (gitignored):
    <id>.json             the session: name, participants + consent,
                          status, stage, errors, warnings, timings
    <id>.transcript.json  the transcript segments, once ready (kept separate so
                          the status file stays small and is easy to delete)
    <id>.summary.json     the structured session notes, if summarizing worked
And in data/:
    deletions.json        a content-free record of deleted sessions (see delete())

Writes go to a temporary file first and then replace the real file in one
step, so a crash can never leave a half-written session behind. A lock stops
the web server and the background job from overwriting each other's changes.

Session ids are random 32-character hex strings. Anything else is rejected
before it gets near the file system, so an id can't be used to reach other files.
"""

import json
import os
import re
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import config

_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
_lock = threading.RLock()


def now_iso() -> str:
    """Current time in UTC, e.g. 2026-10-13T18:04:05Z."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def new_id() -> str:
    return uuid.uuid4().hex


def is_valid_id(session_id: str) -> bool:
    return bool(_ID_PATTERN.match(session_id))


def _session_path(session_id: str) -> Path:
    return config.SESSIONS_DIR / f"{session_id}.json"


def _transcript_path(session_id: str) -> Path:
    return config.SESSIONS_DIR / f"{session_id}.transcript.json"


def _summary_path(session_id: str) -> Path:
    return config.SESSIONS_DIR / f"{session_id}.summary.json"


def _write_json(path: Path, data: Any) -> None:
    """Write JSON atomically: temp file in the same folder, then rename over the target."""
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def _read_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None


def create(session: dict) -> None:
    with _lock:
        _write_json(_session_path(session["id"]), session)


def load(session_id: str) -> dict | None:
    if not is_valid_id(session_id):
        return None
    with _lock:
        return _read_json(_session_path(session_id))


def update(session_id: str, **fields: Any) -> dict:
    """Change some fields of a session and save it. Returns the updated session."""
    with _lock:
        session = _read_json(_session_path(session_id))
        if session is None:
            raise KeyError(session_id)
        session.update(fields)
        _write_json(_session_path(session_id), session)
        return session


def all_sessions() -> list[dict]:
    with _lock:
        return [
            s
            for p in config.SESSIONS_DIR.glob("*.json")
            if not p.name.endswith((".transcript.json", ".summary.json")) and (s := _read_json(p)) is not None
        ]


def save_transcript(session_id: str, segments: list[dict]) -> None:
    _write_json(_transcript_path(session_id), {"segments": segments})


def load_transcript(session_id: str) -> list[dict] | None:
    if not is_valid_id(session_id):
        return None
    data = _read_json(_transcript_path(session_id))
    return None if data is None else data["segments"]


def save_summary(session_id: str, notes: dict) -> None:
    _write_json(_summary_path(session_id), notes)


def has_summary(session_id: str) -> bool:
    return is_valid_id(session_id) and _summary_path(session_id).exists()


def load_summary(session_id: str) -> dict | None:
    if not is_valid_id(session_id):
        return None
    return _read_json(_summary_path(session_id))


# ---------- Deleting ----------

# A content-free record of every deleted session (gitignored, in data/): id,
# when it was created and deleted, and why. No names, no participants, no
# transcript. It shows that a consent withdrawal was honored.
DELETIONS_PATH = config.DATA_DIR / "deletions.json"

DeleteReason = Literal["consent_withdrawn", "other"]


class SessionBusy(Exception):
    """The session is being processed; deleting now would race the background job."""


def delete(session_id: str, reason: DeleteReason, busy_statuses: tuple[str, ...]) -> int:
    """Delete everything stored for a session: audio, transcript, notes, session file.

    Raises KeyError if there's no such session, SessionBusy if its status is in
    busy_statuses. Real (non-test) deletions are added to deletions.json.
    Returns how many files were removed. The check and the delete happen under
    the same lock, so the status can't change in between.
    """
    if not is_valid_id(session_id):
        raise KeyError(session_id)
    with _lock:
        session = _read_json(_session_path(session_id))
        if session is None:
            raise KeyError(session_id)
        if session.get("status") in busy_statuses:
            raise SessionBusy(session_id)

        # The audio is named after the session id; the glob also catches a file
        # left over from an upload that failed part-way.
        removed = delete_audio(session_id)
        files = [
            _transcript_path(session_id),
            _summary_path(session_id),
            _session_path(session_id),  # Last: until it's gone, the session still exists.
        ]
        for path in files:
            if path.exists():
                path.unlink()
                removed += 1

        if not session.get("test"):
            record_deletion(
                {"id": session_id, "created_at": session.get("created_at"), "deleted_at": now_iso(), "reason": reason}
            )
        return removed


def record_deletion(record: dict) -> None:
    """Add one content-free entry (ids, dates, reason) to deletions.json."""
    with _lock:
        _write_json(DELETIONS_PATH, [*(_read_json(DELETIONS_PATH) or []), record])


def delete_audio(session_id: str) -> int:
    """Delete a session's recording (and any part-uploaded copy). Returns how many files went."""
    if not is_valid_id(session_id):
        return 0
    removed = 0
    for path in config.AUDIO_DIR.glob(f"{session_id}.*"):
        path.unlink()
        removed += 1
    return removed


def delete_summary(session_id: str) -> None:
    if is_valid_id(session_id):
        _summary_path(session_id).unlink(missing_ok=True)
