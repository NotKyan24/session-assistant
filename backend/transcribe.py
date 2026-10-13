"""
TRANSCRIPTION ENGINE: the only file that knows about WhisperX.

The rest of the backend calls one function:

    transcribe(path, on_stage=..., on_warning=..., max_speakers=...) -> segments

and gets back a list of {"speaker", "start", "end", "text"} dicts. To try a
different speech-to-text engine later, rewrite this file and keep that shape.

What happens inside, in order (each step reports a stage to `on_stage`):
1. converting            ffmpeg turns any upload (.m4a, .mp3, ...) into a
                         16 kHz mono WAV, the format the models expect.
2. transcribing          Whisper "small" writes down the words, in English.
3. aligning              wav2vec2 finds the exact time of each word.
4. identifying_speakers  pyannote works out who spoke when, and each segment
                         gets the speaker who talked most during it.
If step 4 fails, the transcript still comes back, with every speaker set to
"Unknown", and the problem is reported through `on_warning`.

Models are loaded once (the first time they're needed, or at server start)
and kept in memory, about 2 GB. Each session reuses them.

Privacy: nothing here logs or prints transcript text. WhisperX's own
`verbose` / `print_progress` options would print it, so they're always off.
All models run on this Mac; with HF_HUB_OFFLINE=1 they're read from the local
cache and nothing contacts the internet.

Settings come from the exact command that worked in the Phase 0.5 practice
run: model small, CPU, int8, language en. The diarization call matches the
installed WhisperX 3.8.6, where DiarizationPipeline lives in whisperx.diarize
and takes `token=`.
"""

import config  # noqa: F401  (must come first: sets env flags before pyannote is imported)

import logging
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Callable

log = logging.getLogger("session_assistant.transcribe")

Segment = dict  # {"speaker": str, "start": float, "end": float, "text": str}
UNKNOWN_SPEAKER = "Unknown"


class TranscriptionError(Exception):
    """A problem with this recording; the message is safe to show the user."""


# Loaded models, shared by every job. The lock stops two threads loading them at once.
_models: dict = {}
_load_lock = threading.Lock()


def load_models() -> None:
    """Load the speech, alignment and speaker models if they aren't loaded yet.

    Called at server start so the first session doesn't wait on it. Safe to call
    again; later calls return immediately.
    """
    with _load_lock:
        if _models:
            return
        started = time.monotonic()
        import whisperx  # Heavy import (PyTorch); only done once, here.

        _models["asr"] = whisperx.load_model(
            config.WHISPER_MODEL,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE_TYPE,
            language=config.WHISPER_LANGUAGE,
        )
        _models["align"], _models["align_meta"] = whisperx.load_align_model(
            language_code=config.WHISPER_LANGUAGE, device=config.WHISPER_DEVICE
        )

        # The speaker model is optional: if it can't load (e.g. no HF token and
        # not cached yet), transcription still works, just without speakers.
        try:
            from whisperx.diarize import DiarizationPipeline

            _models["diarize"] = DiarizationPipeline(token=config.HF_TOKEN, device=config.WHISPER_DEVICE)
        except Exception as exc:  # noqa: BLE001
            _models["diarize"] = None
            _models["diarize_error"] = f"{type(exc).__name__}: {exc}"
            log.warning("Speaker model unavailable (%s); transcripts will have Unknown speakers", type(exc).__name__)

        log.info("Models loaded in %.1fs", time.monotonic() - started)


def models_loaded() -> bool:
    return bool(_models)


def _convert_to_wav(source: Path, target: Path) -> None:
    """Convert any audio file to 16 kHz mono 16-bit WAV with ffmpeg."""
    if not config.FFMPEG:
        raise TranscriptionError("ffmpeg is not installed on the server.")
    result = subprocess.run(
        [config.FFMPEG, "-nostdin", "-y", "-loglevel", "error", "-i", str(source),
         "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(target)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        # ffmpeg's message is about the file format, never the speech, so it's safe to log.
        log.warning("ffmpeg could not convert the file: %s", result.stderr.strip()[-300:])
        raise TranscriptionError("The audio file could not be read. It may be damaged or not an audio file.")


def transcribe(
    path: str | Path,
    on_stage: Callable[[str], None] = lambda stage: None,
    on_warning: Callable[[str], None] = lambda message: None,
    max_speakers: int | None = None,
) -> list[Segment]:
    """Turn an audio file into speaker-labeled segments.

    path:         the uploaded audio file, any format ffmpeg can read.
    on_stage:     called with "converting", "transcribing", "aligning",
                  "identifying_speakers" as each step starts.
    on_warning:   called with a user-facing message for non-fatal problems.
    max_speakers: upper limit for speaker detection (e.g. the number of
                  participants); None lets the model decide.
    """
    import whisperx

    load_models()

    with tempfile.TemporaryDirectory(prefix="session-assistant-") as tmp:
        on_stage("converting")
        wav = Path(tmp) / "audio.wav"
        _convert_to_wav(Path(path), wav)
        audio = whisperx.load_audio(str(wav))

        on_stage("transcribing")
        result = _models["asr"].transcribe(
            audio,
            batch_size=config.WHISPER_BATCH_SIZE,
            language=config.WHISPER_LANGUAGE,
            print_progress=False,
            verbose=False,  # True would print the transcript text.
        )
        if not result["segments"]:
            return []  # No speech found.

        on_stage("aligning")
        result = whisperx.align(
            result["segments"],
            _models["align"],
            _models["align_meta"],
            audio,
            config.WHISPER_DEVICE,
            return_char_alignments=False,
            print_progress=False,
        )

        on_stage("identifying_speakers")
        diarizer = _models.get("diarize")
        if diarizer is None:
            on_warning("Speakers could not be identified: the speaker model isn't available on the server.")
        else:
            try:
                speaker_turns = diarizer(audio, max_speakers=max_speakers)
                result = whisperx.assign_word_speakers(speaker_turns, result)
            except Exception as exc:  # noqa: BLE001
                log.warning("Speaker identification failed (%s); returning transcript without speakers", type(exc).__name__)
                on_warning("Speakers could not be identified for this recording, so they're marked Unknown.")

    return [
        {
            "speaker": seg.get("speaker") or UNKNOWN_SPEAKER,
            "start": round(float(seg["start"]), 3),
            "end": round(float(seg["end"]), 3),
            "text": seg["text"].strip(),
        }
        for seg in result["segments"]
    ]
