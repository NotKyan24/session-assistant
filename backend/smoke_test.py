"""
SMOKE TEST: runs the whole backend flow against a running server.

    python smoke_test.py [audio_file] [--url http://localhost:8000]

Default audio file: ../data/audio/test.wav (the Phase 0.5 synthetic clip).
Use consented or synthetic audio only.

The access key is read from API_ACCESS_KEY in the environment or ../.env
(or pass --key). It is never printed.

Checks:
0. A request without the access key is rejected (401), when a key is set.
1. A session missing someone's consent is rejected (400).
2. A non-audio upload is rejected (415).
3. The real flow: create → upload → poll every 3 s until ready → fetch the
   transcript and the summary (if the summary model was reachable).
4. Speaker naming: name a speaker, reject an outsider, clear it again.
5. Roster: add a test person, reject a duplicate, remove them.

Prints statuses, timings, speaker and section counts. It never prints
transcript or summary text.
Uses only the Python standard library.
"""

import argparse
import json
import os
import mimetypes
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

PARTICIPANTS = [
    {"id": "facilitator", "label": "Facilitator"},
    {"id": "youth-001", "label": "youth-001"},
]


# Set in main(); sent with every request as the X-API-Key header.
ACCESS_KEY = ""


def read_access_key() -> str:
    """API_ACCESS_KEY from the environment, else from the repo's .env file."""
    if os.environ.get("API_ACCESS_KEY"):
        return os.environ["API_ACCESS_KEY"]
    env_file = Path(__file__).parent / "../.env"
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            if line.startswith("API_ACCESS_KEY="):
                return line.split("=", 1)[1].strip()
    return ""


def send_json(method: str, url: str, data) -> tuple[int, dict]:
    return call(method, url, json.dumps(data).encode(), {"Content-Type": "application/json"})


def call(
    method: str, url: str, body: bytes | None = None, headers: dict | None = None, send_key: bool = True
) -> tuple[int, dict]:
    headers = dict(headers or {})
    if send_key and ACCESS_KEY:
        headers["X-API-Key"] = ACCESS_KEY
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read() or b"{}")


def post_json(url: str, data: dict) -> tuple[int, dict]:
    return call("POST", url, json.dumps(data).encode(), {"Content-Type": "application/json"})


def post_file(url: str, name: str, content: bytes, content_type: str) -> tuple[int, dict]:
    boundary = uuid.uuid4().hex
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return call("POST", url, body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})


def new_session(base: str, consent_all: bool = True) -> tuple[int, dict]:
    participants = [{**p, "consented": consent_all or i == 0} for i, p in enumerate(PARTICIPANTS)]
    return post_json(f"{base}/api/sessions", {"name": "Smoke test", "mode": "in_person", "participants": participants})


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"[{'PASS' if ok else 'FAIL'}] {label}{f' ({detail})' if detail else ''}")
    if not ok:
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", nargs="?", default=str(Path(__file__).parent / "../data/audio/test.wav"))
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--key", default=None, help="access key (default: API_ACCESS_KEY from .env)")
    args = parser.parse_args()
    base = args.url.rstrip("/")
    audio = Path(args.audio)
    check("audio file exists", audio.is_file(), str(audio))

    global ACCESS_KEY
    ACCESS_KEY = args.key if args.key is not None else read_access_key()
    if ACCESS_KEY:
        status, _ = call("GET", f"{base}/api/sessions/{'0' * 32}", send_key=False)
        check("request without the access key is rejected", status == 401)
    else:
        print("[INFO] no API_ACCESS_KEY found; testing as a request from this Mac")

    status, body = new_session(base, consent_all=False)
    check("missing consent is rejected", status == 400, body.get("detail", ""))

    status, body = new_session(base)
    check("session created", status == 201, f"id {body.get('id')}")
    status, body = post_file(f"{base}/api/sessions/{body['id']}/audio", "notes.txt", b"not audio", "text/plain")
    check("non-audio upload is rejected", status == 415)

    status, body = new_session(base)
    session_id = body["id"]
    check("session created", status == 201, f"id {session_id}")

    content_type = mimetypes.guess_type(audio.name)[0] or "application/octet-stream"
    status, body = post_file(f"{base}/api/sessions/{session_id}/audio", audio.name, audio.read_bytes(), content_type)
    check("audio uploaded", status == 202, f"{audio.stat().st_size / 1e6:.1f} MB")

    started, last_stage = time.monotonic(), None
    while True:
        _, session = call("GET", f"{base}/api/sessions/{session_id}")
        if session["stage"] != last_stage:
            print(f"       {time.monotonic() - started:6.1f}s  stage: {session['stage']}")
            last_stage = session["stage"]
        if session["status"] in ("ready", "failed"):
            break
        time.sleep(3)

    check("processing finished", session["status"] == "ready", session.get("error") or "")
    for warning in session.get("warnings", []):
        print(f"       warning: {warning}")
    print(f"       timings (s): {session['timings']}")

    status, body = call("GET", f"{base}/api/sessions/{session_id}/transcript")
    segments = body.get("segments", [])
    speakers = sorted({s["speaker"] for s in segments})
    check("transcript returned", status == 200 and len(segments) > 0, f"{len(segments)} segments")
    print(f"       speakers: {', '.join(speakers)}")

    status, body = call("GET", f"{base}/api/sessions/{session_id}/summary")
    if status == 200:
        notes = body["summary"]
        counts = ", ".join(f"{s['title']}: {len(s['items'])}" for s in notes["sections"])
        check("summary returned", bool(notes["overview"]), f"model {notes['model']}")
        print(f"       items per section: {counts}")
    else:
        print(f"[INFO] no summary ({body.get('detail', status)}); see the warning above")

    first = speakers[0]
    status, body = send_json("PUT", f"{base}/api/sessions/{session_id}/speakers", {first: "facilitator"})
    check("speaker named", status == 200 and body["speaker_map"].get(first) == "facilitator", f"{first} -> facilitator")
    status, _ = send_json("PUT", f"{base}/api/sessions/{session_id}/speakers", {first: "not-in-session"})
    check("naming a non-participant is rejected", status == 400)
    status, body = send_json("PUT", f"{base}/api/sessions/{session_id}/speakers", {first: None})
    check("speaker name cleared", status == 200 and first not in body["speaker_map"])

    test_id = "smoke-test-person"
    call("DELETE", f"{base}/api/roster/{test_id}")  # Leftover from an interrupted run, if any.
    status, _ = send_json("POST", f"{base}/api/roster", {"id": test_id, "label": "Smoke Test"})
    check("roster: person added", status == 201)
    status, _ = send_json("POST", f"{base}/api/roster", {"id": test_id, "label": "Smoke Test"})
    check("roster: duplicate rejected", status == 409)
    status, _ = send_json("POST", f"{base}/api/roster", {"id": "bad id!", "label": "x"})
    check("roster: invalid id rejected", status == 400)
    status, body = call("GET", f"{base}/api/roster")
    check("roster: listed", status == 200 and any(p["id"] == test_id for p in body["people"]), f"{len(body['people'])} people")
    status, _ = call("DELETE", f"{base}/api/roster/{test_id}")
    _, body = call("GET", f"{base}/api/roster")
    check("roster: person removed", status == 200 and not any(p["id"] == test_id for p in body["people"]))


if __name__ == "__main__":
    main()
