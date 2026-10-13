"""
SESSION STORAGE: one JSON file per session, no database.

Files, all in data/sessions/ (gitignored):
    <id>.json             the session: name, mode, participants + consent,
                          status, stage, errors, warnings, timings
    <id>.transcript.json  the transcript segments, once ready (kept separate so
                          the status file stays small and is easy to delete)

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
from typing import Any

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
            if not p.name.endswith(".transcript.json") and (s := _read_json(p)) is not None
        ]


def save_transcript(session_id: str, segments: list[dict]) -> None:
    _write_json(_transcript_path(session_id), {"segments": segments})


def load_transcript(session_id: str) -> list[dict] | None:
    if not is_valid_id(session_id):
        return None
    data = _read_json(_transcript_path(session_id))
    return None if data is None else data["segments"]
