"""
SESSION ASSISTANT BACKEND: the FastAPI server the phone app talks to.

Run it (from backend/, with the venv active):
    uvicorn main:app --host 0.0.0.0 --port 8000
--host 0.0.0.0 lets the phone reach it over local Wi-Fi. Interactive API docs:
http://localhost:8000/docs

Endpoints (the phone's src/lib/api.ts calls exactly these):
    POST /api/sessions                    create a session; 400 unless everyone consented
    POST /api/sessions/{id}/audio         upload the recording; starts transcription
    GET  /api/sessions/{id}               status + current stage (the app polls this)
    GET  /api/sessions/{id}/transcript    the segments, once status is "ready"
    GET  /api/sessions/{id}/summary       the structured session notes, once "ready"
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

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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

# One worker = one transcription at a time.
worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="transcribe")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once at startup (before `yield`) and once at shutdown (after it)."""
    if not config.FFMPEG:
        log.error("ffmpeg not found; uploads will fail. Install it with: brew install ffmpeg")

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
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---------- Request bodies (validated automatically by FastAPI) ----------


class ParticipantIn(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$", examples=["youth-001"])
    label: str = Field(min_length=1, max_length=100, examples=["youth-001"])
    consented: bool


class SessionIn(BaseModel):
    name: str = Field(min_length=1, max_length=200, examples=["Tue group, Oct 13"])
    mode: Literal["in_person", "video"]
    participants: list[ParticipantIn] = Field(min_length=1, max_length=50)


# ---------- Helpers ----------


def _get_session_or_404(session_id: str) -> dict:
    session = sessions.load(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


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
        "failed_stage": session.get("failed_stage"),
        "error": session.get("error"),
        "warnings": session.get("warnings", []),
        "timings": session.get("timings", {}),
    }


def _run_job(session_id: str, audio_path: Path) -> None:
    """The background job: transcribe one upload and save the result.

    Runs on the worker thread. Each stage change is saved to the session file,
    which is what the app sees when it polls.
    """
    session = sessions.load(session_id)
    job_started = time.monotonic()
    stage_started = job_started
    timings: dict[str, float] = {}
    current = {"stage": "uploaded"}

    def on_stage(stage: str) -> None:
        nonlocal stage_started
        now = time.monotonic()
        timings[current["stage"]] = round(now - stage_started, 1)
        log.info("Session %s: %s done in %.1fs; now %s", session_id, current["stage"], now - stage_started, stage)
        current["stage"] = stage
        stage_started = now
        sessions.update(session_id, status=stage, stage=stage, timings=timings)

    def on_warning(message: str) -> None:
        latest = sessions.load(session_id)
        sessions.update(session_id, warnings=[*latest.get("warnings", []), message])

    try:
        segments = engine.transcribe(
            audio_path,
            on_stage=on_stage,
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
        sessions.update(session_id, status="ready", stage="ready", timings=timings, segment_count=len(segments))
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


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "models_loaded": engine.models_loaded(),
        "ffmpeg": bool(config.FFMPEG),
        "summaries_configured": summarizer.is_configured(),
    }


@app.post("/api/sessions", status_code=201)
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
    }
    sessions.create(session)
    log.info("Session %s: created (%d participants, %s)", session["id"], len(ids), body.mode)
    return {"id": session["id"]}


@app.post("/api/sessions/{session_id}/audio", status_code=202)
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

    # Copy in 1 MB pieces, stopping as soon as it's over the size limit.
    audio_path = config.AUDIO_DIR / f"{session_id}{extension}"
    size = 0
    try:
        with audio_path.open("wb") as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > config.MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail=f"File is larger than {config.MAX_UPLOAD_MB} MB.")
                out.write(chunk)
    except BaseException:
        audio_path.unlink(missing_ok=True)
        raise
    if size == 0:
        audio_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    sessions.update(
        session_id,
        status="uploaded",
        stage="uploaded",
        audio_file=audio_path.name,
        audio_bytes=size,
        uploaded_at=sessions.now_iso(),
    )
    log.info("Session %s: uploaded %.1f MB (%s)", session_id, size / 1_000_000, extension)
    worker.submit(_run_job, session_id, audio_path)
    return {"id": session_id, "status": "uploaded"}


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str) -> dict:
    return _public_view(_get_session_or_404(session_id))


@app.get("/api/sessions/{session_id}/transcript")
def get_transcript(session_id: str) -> dict:
    session = _get_session_or_404(session_id)
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="The transcript isn't ready yet.")
    segments = sessions.load_transcript(session_id)
    if segments is None:
        raise HTTPException(status_code=500, detail="The transcript file is missing.")
    return {"segments": segments}


@app.get("/api/sessions/{session_id}/summary")
def get_summary(session_id: str) -> dict:
    session = _get_session_or_404(session_id)
    if session["status"] != "ready":
        raise HTTPException(status_code=409, detail="The summary isn't ready yet.")
    notes = sessions.load_summary(session_id)
    if notes is None:
        raise HTTPException(status_code=404, detail="There's no summary for this session.")
    return {"summary": notes}
