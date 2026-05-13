"""
Speech-to-text service.

Primary: faster-whisper running locally.
Fallback: Groq Whisper-compatible transcription endpoint.
"""
from __future__ import annotations

import os
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from utils.logger import setup_logger

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

logger = setup_logger(__name__)


@lru_cache(maxsize=1)
def _get_whisper_model():
    from faster_whisper import WhisperModel

    model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
    device = os.getenv("WHISPER_DEVICE", "cpu")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    logger.info(
        "Loading faster-whisper model: %s (%s/%s)",
        model_size,
        device,
        compute_type,
    )
    return WhisperModel(model_size, device=device, compute_type=compute_type)


def _convert_to_wav(audio_path: str) -> str:
    source = Path(audio_path)
    if not source.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name

    try:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(str(source))
        audio = audio.set_channels(1).set_frame_rate(16000)
        audio.export(wav_path, format="wav")
        return wav_path
    except Exception as pydub_error:
        logger.warning("pydub conversion failed, trying ffmpeg: %s", pydub_error)

    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-ar",
            "16000",
            "-ac",
            "1",
            "-y",
            wav_path,
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[-500:]}")
    return wav_path


def _transcribe_with_faster_whisper(audio_path: str) -> dict[str, Any]:
    wav_path = _convert_to_wav(audio_path)
    try:
        model = _get_whisper_model()
        use_word_timestamps = (
            os.getenv("WHISPER_WORD_TIMESTAMPS", "true").lower()
            in {"1", "true", "yes", "on"}
        )
        use_vad_filter = (
            os.getenv("WHISPER_VAD_FILTER", "true").lower()
            in {"1", "true", "yes", "on"}
        )
        segments, info = model.transcribe(
            wav_path,
            beam_size=int(os.getenv("WHISPER_BEAM_SIZE", "3")),
            language=os.getenv("WHISPER_LANGUAGE", "en"),
            vad_filter=use_vad_filter,
            vad_parameters={
                "min_silence_duration_ms": int(
                    os.getenv("WHISPER_MIN_SILENCE_MS", "500")
                )
            },
            word_timestamps=use_word_timestamps,
        )

        segment_list = []
        word_list = []
        for segment in segments:
            words = []
            for word in getattr(segment, "words", None) or []:
                word_item = {
                    "start": round(float(word.start), 3),
                    "end": round(float(word.end), 3),
                    "word": str(word.word).strip(),
                    "probability": round(float(getattr(word, "probability", 0.0)), 3),
                }
                words.append(word_item)
                word_list.append(word_item)

            segment_list.append(
                {
                    "start": round(float(segment.start), 2),
                    "end": round(float(segment.end), 2),
                    "text": segment.text.strip(),
                    "words": words,
                }
            )
        transcript = " ".join(item["text"] for item in segment_list).strip()

        return {
            "transcript": transcript or "No speech detected",
            "provider": "faster-whisper",
            "model": os.getenv("WHISPER_MODEL_SIZE", "base"),
            "language": getattr(info, "language", "en"),
            "language_probability": round(
                float(getattr(info, "language_probability", 0.0)), 3
            ),
            "segments": segment_list,
            "words": word_list,
            "word_timestamps": use_word_timestamps,
            "vad_filter": use_vad_filter,
            "compute_type": os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        }
    finally:
        if os.path.exists(wav_path):
            os.unlink(wav_path)


def _transcribe_with_groq(audio_path: str) -> dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    from groq import Groq

    model_name = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")
    client = Groq(api_key=api_key)

    with open(audio_path, "rb") as handle:
        response = client.audio.transcriptions.create(
            file=handle,
            model=model_name,
            response_format="verbose_json",
            language=os.getenv("WHISPER_LANGUAGE", "en"),
        )

    transcript = getattr(response, "text", None)
    if transcript is None and isinstance(response, dict):
        transcript = response.get("text")

    segments = getattr(response, "segments", None)
    if segments is None and isinstance(response, dict):
        segments = response.get("segments", [])

    normalized_segments = []
    for segment in segments or []:
        if isinstance(segment, dict):
            normalized_segments.append(
                {
                    "start": round(float(segment.get("start", 0.0)), 2),
                    "end": round(float(segment.get("end", 0.0)), 2),
                    "text": str(segment.get("text", "")).strip(),
                }
            )

    return {
        "transcript": (transcript or "No speech detected").strip(),
        "provider": "groq-whisper",
        "model": model_name,
        "language": os.getenv("WHISPER_LANGUAGE", "en"),
        "language_probability": None,
        "segments": normalized_segments,
    }


def transcribe_file(audio_path: str) -> dict[str, Any]:
    provider = os.getenv("STT_PROVIDER", "local").lower()
    errors: list[str] = []

    if provider in {"local", "faster-whisper", "auto"}:
        try:
            return _transcribe_with_faster_whisper(audio_path)
        except Exception as error:
            errors.append(f"faster-whisper: {error}")
            logger.warning("faster-whisper transcription failed: %s", error)

    if provider in {"groq", "auto", "local", "faster-whisper"}:
        try:
            return _transcribe_with_groq(audio_path)
        except Exception as error:
            errors.append(f"groq-whisper: {error}")
            logger.warning("Groq transcription failed: %s", error)

    raise RuntimeError("All STT providers failed. " + " | ".join(errors))
