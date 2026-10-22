"""
ROSTER: the shared list of people who can be in a session.

Stored in data/roster.json (gitignored), so every device sees the same people.
Each person has:
    id        what the system stores and links (e.g. "youth-004")
    label     the display name staff see; display-only, never logged
    added_at  when they were added
    active    False once removed

Removing someone only hides them from future sessions (active = False). Past
sessions keep their own copy of who took part, so their records never change.
Adding a removed id again brings that person back.

The first time the roster is read, it is seeded with the Day 1 test
participants so the app keeps working.
"""

import re
import threading

import config
import sessions

ROSTER_PATH = config.DATA_DIR / "roster.json"
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

_SEED = [
    ("facilitator", "Facilitator"),
    ("youth-001", "youth-001"),
    ("youth-002", "youth-002"),
    ("youth-003", "youth-003"),
]

_lock = threading.Lock()


class RosterError(Exception):
    """A request the roster can't accept; the message is safe to show the user."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _load() -> dict:
    data = sessions._read_json(ROSTER_PATH)
    if data is None:
        now = sessions.now_iso()
        data = {"people": [{"id": i, "label": l, "added_at": now, "active": True} for i, l in _SEED]}
        sessions._write_json(ROSTER_PATH, data)
    return data


def _public(person: dict) -> dict:
    return {"id": person["id"], "label": person["label"]}


def list_people() -> list[dict]:
    """Everyone currently on the roster, in the order they were added."""
    with _lock:
        return [_public(p) for p in _load()["people"] if p["active"]]


def add_person(person_id: str, label: str) -> dict:
    person_id, label = person_id.strip(), label.strip()
    if not ID_PATTERN.match(person_id):
        raise RosterError("IDs can only use letters, numbers, - and _ (up to 64 characters), e.g. youth-004.")
    if not label:
        label = person_id
    with _lock:
        data = _load()
        existing = next((p for p in data["people"] if p["id"] == person_id), None)
        if existing and existing["active"]:
            raise RosterError(f"{person_id} is already on the roster.", status_code=409)
        if existing:
            existing.update(label=label, active=True, readded_at=sessions.now_iso())
            existing.pop("removed_at", None)
            person = existing
        else:
            person = {"id": person_id, "label": label, "added_at": sessions.now_iso(), "active": True}
            data["people"].append(person)
        sessions._write_json(ROSTER_PATH, data)
        return _public(person)


def remove_person(person_id: str) -> None:
    with _lock:
        data = _load()
        person = next((p for p in data["people"] if p["id"] == person_id and p["active"]), None)
        if person is None:
            raise RosterError(f"{person_id} isn't on the roster.", status_code=404)
        person.update(active=False, removed_at=sessions.now_iso())
        sessions._write_json(ROSTER_PATH, data)
