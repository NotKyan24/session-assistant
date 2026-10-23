"""
SESSION ASSISTANT BACKEND: the FastAPI server the phone app talks to.

Run it (from backend/, with the venv active):
    uvicorn main:app --host 127.0.0.1 --port 8000      # this Mac only (browser testing)
    uvicorn main:app --host 0.0.0.0 --port 8000        # phone testing over Wi-Fi
--host 0.0.0.0 opens the server to the whole network, which on some networks
(e.g. a university's public addresses) means the internet. Every /api request
therefore needs the access key (API_ACCESS_KEY in .env, sent as an "X-API-Key"
header). Interactive API docs: http://localhost:8000/docs (use "Authorize" to
enter the key).

Endpoints (the phone's src/lib/api.ts calls exactly these):
    POST /api/sessions                    create a session; 400 unless everyone consented
    POST /api/sessions/{id}/audio         upload the recording; starts transcription
                                          (409 if the same recording already has a session)
    GET  /api/sessions                    list past sessions, newest first (?q= to search)
    GET  /api/sessions/{id}               status + current stage (the app polls this)
    GET  /api/sessions/{id}/transcript    the segments, once status is "ready"
    GET  /api/sessions/{id}/summary       the structured session notes, once "ready"
    GET  /api/sessions/{id}/metrics       participation numbers, once "ready"
    PUT  /api/sessions/{id}/speakers      say which participant each speaker is
    GET  /api/roster                      everyone on the shared roster
    POST /api/roster                      add someone to the roster
    DELETE /api/roster/{person_id}        remove someone (past sessions keep them)
    GET  /api/health                      quick "is the server up?" check

Transcription runs in a single background worker thread: one job at a time,
in upload order. The web server stays free to answer status checks while a
job runs.

A session's status moves through:
    created → uploaded → converting → transcribing → aligning
            → identifying_speakers → summarizing → ready   (or → failed)
If summarizing fails, the session is still "ready" with its transcript, plus
a warning that the summary is missing.

Privacy: logs show session ids, stages and timings only, never transcript
text, summaries, session names or participant labels.
"""

import config  # noqa: F401  (must come first: loads .env and sets env flags)

import hashlib
import logging
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, HTTPException, Request, Security, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

import metrics
import roster
import sessions
import summarize as summarizer
import transcribe as engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("session_assistant")

# Stages while a job is running. A session stuck in one of these after a
# restart was interrupted, and is marked failed at startup.
PROCESSING_STAGES = ("uploaded", "converting", "transcribing", "aligning", "identifying_speakers", "summarizing")

# Audio formats we accept, by file extension. ffmpeg converts all of them.
ALLOWED_EXTENSIONS = {".m4a", ".mp3", ".wav", ".webm", ".mp4", ".aac", ".caf", ".ogg", ".flac"}
# Phones don't always send an audio/* type (e.g. iOS may send video/mp4 for .m4a,
# or a generic binary type), so these are allowed too.
ALLOWED_GENERIC_TYPES = {"application/octet-stream", "video/mp4", "video/webm", ""}

# Progress is saved at most this often, so long jobs don't rewrite the session
# file hundreds of times a second. The app polls every 3 s anyway.
PROGRESS_SAVE_SECONDS = 2.0
# Below this much progress, a time estimate is mostly noise, so none is given.
MIN_PROGRESS_FOR_ESTIMATE = 3.0

# One worker = one transcription at a time.
worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="transcribe")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once at startup (before `yield`) and once at shutdown (after it)."""
    if not config.FFMPEG:
        log.error("ffmpeg not found; uploads will fail. Install it with: brew install ffmpeg")
    if not config.API_ACCESS_KEY:
        log.warning("No API_ACCESS_KEY in .env: only requests from this Mac will be accepted.")

    for s in sessions.all_sessions():
        if s.get("status") in PROCESSING_STAGES:
            sessions.update(
                s["id"],
                status="failed",
                failed_stage=s.get("stage"),
                stage="failed",
                error="The server restarted while this recording was being processed. Please upload it again.",
            )
            log.info("Session %s: marked failed (interrupted by restart)", s["id"])

    # Load models in the background, ahead of any upload. Jobs queue behind this.
    worker.submit(engine.load_models)
    yield
    worker.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="Session Assistant", lifespan=lifespan)

# Let the Expo *web* build (a browser page at localhost:8081) call this API.
# Browsers ask permission first with an OPTIONS "preflight" request; this
# answers it. Only the listed addresses are allowed (see config.CORS_ORIGINS).
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-API-Key"],
)


# ---------- Request bodies (validated automatically by FastAPI) ----------


class ParticipantIn(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$", examples=["youth-001"])
    label: str = Field(min_length=1, max_length=100, examples=["youth-001"])
    consented: bool


class PersonIn(BaseModel):
    id: str = Field(min_length=1, max_length=64, examples=["youth-004"])
    label: str = Field(default="", max_length=100, examples=["youth-004"])


class SessionIn(BaseModel):
    name: str = Field(min_length=1, max_length=200, examples=["Tue group, Oct 13"])
    mode: Literal["in_person", "video"]
    participants: list[ParticipantIn] = Field(min_length=1, max_length=50)
    # Set only by smoke_test.py, so test sessions stay out of the Past sessions list.
    test: bool = False


# ---------- Access key ----------

# Declared this way so the /docs page shows an "Authorize" button for the key.
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False, description="The API_ACCESS_KEY from .env")
_LOCAL_CLIENTS = {"127.0.0.1", "::1"}


def require_access(request: Request, key: str | None = Security(_api_key_header)) -> None:
    """Let a request through only if it carries the right access key.

    With no key configured, only requests from this Mac itself are allowed, so a
    forgotten key never leaves the server open to the network.
    """
    if config.API_ACCESS_KEY:
        if key and secrets.compare_digest(key.encode(), config.API_ACCESS_KEY.encode()):
            return
        raise HTTPException(status_code=401, detail="Missing or wrong access key.")
    if request.client and request.client.host in _LOCAL_CLIENTS:
        return
    raise HTTPException(status_code=401, detail="This server has no access key set, so only this Mac can use it.")


protected = [Depends(require_access)]


# ---------- Helpers ----------


def _audio_fingerprint(session: dict) -> str | None:
    """A session's recording fingerprint; worked out (and saved) once for older sessions."""
    if session.get("audio_sha256"):
        return session["audio_sha256"]
    audio = session.get("audio_file")
    if not audio or not (config.AUDIO_DIR / audio).exists():
        return None
    digest = hashlib.sha256()
    with (config.AUDIO_DIR / audio).open("rb") as f:
        while chunk := f.read(1024 * 1024):
            digest.update(chunk)
    sessions.update(session["id"], audio_sha256=digest.hexdigest())
    return digest.hexdigest()


def _find_same_recording(audio_sha256: str, exclude_id: str) -> dict | None:
    """Another real session (not a test, not failed) made from exactly the same audio file."""
    for s in sessions.all_sessions():
        is_test = s.get("test") or s["name"] in _OLD_TEST_NAMES
        if s["id"] == exclude_id or is_test or s["status"] in ("created", "failed"):
            continue
        if _audio_fingerprint(s) == audio_sha256:
            return s
    return None


def _get_session_or_404(session_id: str) -> dict:
    session = sessions.load(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


def _estimate_seconds_left(session: dict) -> int | None:
    """Rough time left in the current stage, from how fast it has progressed so far.

    E.g. 25% done after 5 minutes → about 15 more minutes. None when the stage
    doesn't report progress or it's too early to tell.
    """
    progress, started = session.get("progress"), session.get("stage_started_at")
    if progress is None or started is None or progress < MIN_PROGRESS_FOR_ESTIMATE or progress >= 100:
        return None
    elapsed = time.time() - started
    return round(elapsed * (100 - progress) / progress)


def _public_view(session: dict) -> dict:
    """What GET /api/sessions/{id} returns (the stored file minus internal fields)."""
    return {
        "id": session["id"],
        "name": session["name"],
        "mode": session["mode"],
        "created_at": session["created_at"],
        "participants": session["participants"],
        "status": session["status"],
        "stage": session["stage"],
        # How far the current stage is, 0-100, or null for stages that don't
        # report it (converting, summarizing) and when finished.
        "progress": session.get("progress"),
        "seconds_left": _estimate_seconds_left(session),
        "failed_stage": session.get("failed_stage"),
        "error": session.get("error"),
        "warnings": session.get("warnings", []),
        "timings": session.get("timings", {}),
        # Which participant (by id) each speaker label belongs to, once staff say so.
        "speaker_map": session.get("speaker_map", {}),
    }


def _run_job(session_id: str, audio_path: Path) -> None:
    """The background job: transcribe one upload and save the result.

    Runs on the worker thread. Each stage change, and the progress within long
    stages, is saved to the session file, which is what the app sees when it polls.
    """
    session = sessions.load(session_id)
    job_started = time.monotonic()
    stage_started = job_started
    timings: dict[str, float] = {}
    current = {"stage": "uploaded"}
    last_progress_save = 0.0

    def on_stage(stage: str) -> None:
        nonlocal stage_started
        now = time.monotonic()
        timings[current["stage"]] = round(now - stage_started, 1)
        log.info("Session %s: %s done in %.1fs; now %s", session_id, current["stage"], now - stage_started, stage)
        current["stage"] = stage
        stage_started = now
        # A new stage starts with no progress yet; time.time() (wall clock) is
        # stored so the estimate survives being read by another thread.
        sessions.update(session_id, status=stage, stage=stage, timings=timings, progress=None, stage_started_at=time.time())

    def on_progress(percent: float) -> None:
        nonlocal last_progress_save
        now = time.monotonic()
        if now - last_progress_save < PROGRESS_SAVE_SECONDS and percent < 100:
            return
        last_progress_save = now
        sessions.update(session_id, progress=round(min(max(percent, 0.0), 100.0), 1))

    def on_warning(message: str) -> None:
        latest = sessions.load(session_id)
        sessions.update(session_id, warnings=[*latest.get("warnings", []), message])

    try:
        segments = engine.transcribe(
            audio_path,
            on_stage=on_stage,
            on_progress=on_progress,
            on_warning=on_warning,
            # More speakers than participants is impossible, so cap detection there.
            max_speakers=len(session["participants"]),
        )
        sessions.save_transcript(session_id, segments)

        # Summarizing is a bonus: if it fails, the transcript is still delivered.
        if segments:
            on_stage("summarizing")
            try:
                sessions.save_summary(session_id, summarizer.summarize(segments))
            except summarizer.SummaryError as exc:
                on_warning(f"No summary for this session: {exc}")
                log.info("Session %s: summary skipped (%s)", session_id, exc)

        timings[current["stage"]] = round(time.monotonic() - stage_started, 1)
        timings["total"] = round(time.monotonic() - job_started, 1)
        sessions.update(
            session_id,
            status="ready",
            stage="ready",
            timings=timings,
            segment_count=len(segments),
            progress=None,
            # Kept for the Past sessions list (up to the end of the last speech).
            length_seconds=metrics.participation(segments)["session"]["length_seconds"],
        )
        log.info("Session %s: ready in %.1fs (%d segments)", session_id, timings["total"], len(segments))
    except engine.TranscriptionError as exc:
        sessions.update(session_id, status="failed", stage="failed", failed_stage=current["stage"], error=str(exc), timings=timings)
        log.info("Session %s: failed during %s", session_id, current["stage"])
    except Exception:  # noqa: BLE001
        # Unexpected bug: keep the traceback for debugging (it holds code
        # locations, not speech), and give the user a plain message.
        log.exception("Session %s: unexpected error during %s", session_id, current["stage"])
        sessions.update(
            session_id,
            status="failed",
            stage="failed",
            failed_stage=current["stage"],
            error="Something went wrong on the server while processing this recording.",
            timings=timings,
        )


# ---------- Endpoints ----------


# Health stays open (no key) so connection problems are easy to tell apart from
# key problems. It shows nothing about sessions.
@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "models_loaded": engine.models_loaded(),
        "ffmpeg": bool(config.FFMPEG),
        "summaries_configured": summarizer.is_configured(),
    }


@app.post("/api/sessions", status_code=201, dependencies=protected)
def create_session(body: SessionIn) -> dict:
    missing = [p.id for p in body.participants if not p.consented]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing consent from: {', '.join(missing)}")

    ids = [p.id for p in body.participants]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail="Each participant can only be listed once.")

    created = sessions.now_iso()
    session = {
        "id": sessions.new_id(),
        "name": body.name.strip(),
        "mode": body.mode,
        "created_at": created,
        # Stored by id; label is display-only. Consent is timestamped per person.
        "participants": [
            {"id": p.id, "label": p.label, "consented": True, "consented_at": created} for p in body.participants
        ],
        "status": "created",
        "stage": "created",
        "warnings": [],
        "timings": {},
        "test": body.test,
    }
    sessions.create(session)
    log.info("Session %s: created (%d participants, %s)", session["id"], len(ids), body.mode)
    return {"id": session["id"]}


@app.post("/api/sessions/{session_id}/audio", status_code=202, dependencies=protected)
def upload_audio(session_id: str, file: UploadFile = File(...)) -> dict:
    session = _get_session_or_404(session_id)
    if session["status"] != "created":
        raise HTTPException(status_code=409, detail="This session already has a recording.")

    extension = Path(file.filename or "").suffix.lower()
    content_type = (file.content_type or "").lower()
    if extension not in ALLOWED_EXTENSIONS or not (
        content_type.startswith("audio/") or content_type in ALLOWED_GENERIC_TYPES
    ):
        raise HTTPException(
            status_code=415,
            detail=f"Not an audio file. Accepted types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Copy in 1 MB pieces, stopping as soon as it's over the size limit, and
    # take the file's fingerprint (SHA-256) on the way to spot repeat uploads.
    audio_path = config.AUDIO_DIR / f"{session_id}{extension}"
    size = 0
    fingerprint = hashlib.sha256()
    try:
        with audio_path.open("wb") as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > config.MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail=f"File is larger than {config.MAX_UPLOAD_MB} MB.")
                fingerprint.update(chunk)
                out.write(chunk)
    except BaseException:
        audio_path.unlink(missing_ok=True)
        raise
    if size == 0:
        audio_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    # The same recording already has a finished (or in-progress) session: don't
    # process it again. Test sessions skip this (the smoke test reuses one clip),
    # and a failed earlier attempt doesn't block a retry.
    audio_sha256 = fingerprint.hexdigest()
    if not session.get("test"):
        existing = _find_same_recording(audio_sha256, exclude_id=session_id)
        if existing:
            audio_path.unlink(missing_ok=True)
            log.info("Session %s: upload refused, same recording as session %s", session_id, existing["id"])
            raise HTTPException(
                status_code=409,
                detail={
                    "message": (
                        "This recording was already processed."
                        if existing["status"] == "ready"
                        else "This recording is already being processed."
                    ),
                    "existing_session_id": existing["id"],
                    "existing_status": existing["status"],
                },
            )

    sessions.update(
        session_id,
        status="uploaded",
        stage="uploaded",
        audio_file=audio_path.name,
        audio_bytes=size,
        audio_sha256=audio_sha256,
        uploaded_at=sessions.now_iso(),
    )
    log.info("Session %s: uploaded %.1f MB (%s)", session_id, size / 1_000_000, extension)
    worker.submit(_run_job, session_id, audio_path)
    return {"id": session_id, "status": "uploaded"}


@app.get("/api/sessions/{session_id}", dependencies=protected)
def get_session(session_id: str) -> dict:
    return _public_view(_get_session_or_404(session_id))


@app.get("/api/sessions/{session_id}/transcript", dependencies=protected)
def get_transcript(session_id: str) -> dict:
    session = _get_session_or_404(session_id)
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="The transcript isn't ready yet.")
    segments = sessions.load_transcript(session_id)
    if segments is None:
        raise HTTPException(status_code=500, detail="The transcript file is missing.")
    return {"segments": segments}


@app.get("/api/sessions/{session_id}/summary", dependencies=protected)
def get_summary(session_id: str) -> dict:
    session = _get_session_or_404(session_id)
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="The summary isn't ready yet.")
    notes = sessions.load_summary(session_id)
    if notes is None:
        raise HTTPException(status_code=404, detail="There's no summary for this session.")
    return {"summary": notes}


@app.put("/api/sessions/{session_id}/speakers", dependencies=protected)
def set_speakers(session_id: str, body: dict[str, str | None]) -> dict:
    """Say which participant each speaker label is, e.g. {"SPEAKER_00": "facilitator"}.

    Only speakers found in this session's transcript and participants of this
    session are accepted. null clears a speaker back to "Speaker N". Stored by
    participant id only.
    """
    session = _get_session_or_404(session_id)
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="Speakers can be named once the transcript is ready.")
    speakers = {s["speaker"] for s in sessions.load_transcript(session_id) or []}
    participant_ids = {p["id"] for p in session["participants"]}
    speaker_map = dict(session.get("speaker_map", {}))
    for speaker, person_id in body.items():
        if speaker not in speakers:
            raise HTTPException(status_code=400, detail=f"{speaker} isn't a speaker in this transcript.")
        if person_id is None:
            speaker_map.pop(speaker, None)
        elif person_id not in participant_ids:
            raise HTTPException(status_code=400, detail=f"{person_id} isn't a participant in this session.")
        else:
            speaker_map[speaker] = person_id
    sessions.update(session_id, speaker_map=speaker_map)
    log.info("Session %s: speaker names updated (%d of %d named)", session_id, len(speaker_map), len(speakers))
    return {"speaker_map": speaker_map}


@app.get("/api/roster", dependencies=protected)
def get_roster() -> dict:
    return {"people": roster.list_people()}


@app.post("/api/roster", status_code=201, dependencies=protected)
def add_to_roster(body: PersonIn) -> dict:
    try:
        person = roster.add_person(body.id, body.label)
    except roster.RosterError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    log.info("Roster: added %s", person["id"])
    return person


@app.delete("/api/roster/{person_id}", dependencies=protected)
def remove_from_roster(person_id: str) -> dict:
    try:
        roster.remove_person(person_id)
    except roster.RosterError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    log.info("Roster: removed %s", person_id)
    return {"removed": person_id}


@app.get("/api/sessions/{session_id}/metrics", dependencies=protected)
def get_metrics(session_id: str) -> dict:
    """Participation numbers per speaker (see metrics.py), computed from the transcript on request."""
    session = _get_session_or_404(session_id)
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="Participation numbers are ready once the transcript is.")
    segments = sessions.load_transcript(session_id)
    if segments is None:
        raise HTTPException(status_code=500, detail="The transcript file is missing.")
    return {"metrics": metrics.participation(segments)}


# Names the smoke test used before sessions were marked with "test". Only these
# exact names count; real sessions are never matched.
_OLD_TEST_NAMES = {"Smoke test", "Broken file test", "Long upload test"}
SESSION_PAGE_SIZE = 30


def _is_hidden(session: dict) -> bool:
    """Test sessions and sessions never recorded are left out of the list by default."""
    is_test = session.get("test") or session["name"] in _OLD_TEST_NAMES
    return bool(is_test) or session["status"] == "created"


def _length_seconds(session: dict) -> float | None:
    """The recording length; filled in once from the transcript for older sessions."""
    if "length_seconds" in session or session["status"] != "ready":
        return session.get("length_seconds")
    segments = sessions.load_transcript(session["id"]) or []
    length = metrics.participation(segments)["session"]["length_seconds"]
    sessions.update(session["id"], length_seconds=length)
    return length


@app.get("/api/sessions", dependencies=protected)
def list_sessions(q: str = "", include_hidden: bool = False, offset: int = 0, limit: int = SESSION_PAGE_SIZE) -> dict:
    """Past sessions, newest first, a page at a time.

    q searches the session name and participant names/IDs (not the transcript).
    Test sessions and never-recorded ones are hidden unless include_hidden.
    Nothing is deleted; hidden sessions stay on disk.
    """
    query = q.strip().lower()
    matches = []
    for s in sessions.all_sessions():
        if not include_hidden and _is_hidden(s):
            continue
        haystack = [s["name"]] + [p["label"] for p in s["participants"]] + [p["id"] for p in s["participants"]]
        if query and not any(query in text.lower() for text in haystack):
            continue
        matches.append(s)
    matches.sort(key=lambda s: s["created_at"], reverse=True)

    limit = max(1, min(limit, 100))
    page = matches[max(0, offset) : max(0, offset) + limit]
    items = [
        {
            "id": s["id"],
            "name": s["name"],
            "mode": s["mode"],
            "created_at": s["created_at"],
            "status": s["status"],
            "failed_stage": s.get("failed_stage"),
            "participants": [{"id": p["id"], "label": p["label"]} for p in s["participants"]],
            "length_seconds": _length_seconds(s),
            "has_summary": sessions.has_summary(s["id"]),
            "hidden": _is_hidden(s),
        }
        for s in page
    ]
    # Logs never include names or search text.
    log.info("Sessions listed: %d of %d matching", len(items), len(matches))
    return {"sessions": items, "total": len(matches), "has_more": offset + len(items) < len(matches)}

