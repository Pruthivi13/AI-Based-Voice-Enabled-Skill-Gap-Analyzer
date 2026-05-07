"""
Speech-to-text service.

Primary path:
- local faster-whisper, no per-call cost

Fallback path:
- Groq Whisper-compatible transcription API, when GROQ_API_KEY is set
"""

from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

from utils.logger import setup_logger

load_dotenv()
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

logger = setup_logger(__name__)

_model = None


def get_model():
    """Lazy-load faster-whisper once and reuse it across requests."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        device = os.getenv("WHISPER_DEVICE", "cpu")
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

        logger.info(
            "Loading faster-whisper model=%s device=%s compute_type=%s",
            model_size,
            device,
            compute_type,
        )
        _model = WhisperModel(model_size, device=device, compute_type=compute_type)
        logger.info("faster-whisper model loaded")
    return _model


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _ffmpeg_executable() -> str | None:
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def convert_to_wav(audio_path: str | Path) -> str:
    """
    Convert any browser/API audio format to a mono 16 kHz WAV.
    Uses ffmpeg through pydub when possible, with direct ffmpeg fallback.
    """
    source = Path(audio_path)
    if not source.exists():
        raise FileNotFoundError(f"Audio file not found: {source}")

    wav_path = str(source.with_suffix(".wav"))
    if source.suffix.lower() == ".wav":
        return str(source)

    try:
        from pydub import AudioSegment

        ffmpeg_path = _ffmpeg_executable()
        if ffmpeg_path:
            AudioSegment.converter = ffmpeg_path

        audio = AudioSegment.from_file(source)
        audio = audio.set_channels(1).set_frame_rate(16000).normalize()
        audio.export(wav_path, format="wav")
        return wav_path
    except Exception as pydub_error:
        logger.warning("pydub conversion failed, trying ffmpeg: %s", pydub_error)

    ffmpeg_path = _ffmpeg_executable()
    if not ffmpeg_path:
        raise RuntimeError("ffmpeg is required to convert non-WAV audio files")

    result = subprocess.run(
        [
            ffmpeg_path,
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
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr[-500:]}")

    return wav_path


def _local_transcribe(wav_path: str, *, partial: bool = False) -> str:
    model = get_model()
    segments, _ = model.transcribe(
        wav_path,
        beam_size=1 if partial else 3,
        language=os.getenv("STT_LANGUAGE", "en"),
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )
    return " ".join(segment.text.strip() for segment in segments if segment.text).strip()


def _groq_transcribe(audio_path: str) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    from groq import Groq

    model = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")
    client = Groq(api_key=api_key)

    with open(audio_path, "rb") as audio_file:
        result = client.audio.transcriptions.create(
            file=(Path(audio_path).name, audio_file),
            model=model,
            response_format="json",
            language=os.getenv("STT_LANGUAGE", "en"),
        )

    transcript = getattr(result, "text", None)
    if not transcript and isinstance(result, dict):
        transcript = result.get("text")
    return (transcript or "").strip()


def transcribe_audio_file(audio_path: str | Path, *, prefer_local: bool = True) -> str:
    """
    Transcribe an audio file using local faster-whisper, then Groq fallback.
    Returns a plain transcript string.
    """
    source = Path(audio_path)
    wav_path: Optional[str] = None
    created_wav = False

    try:
        wav_path = convert_to_wav(source)
        created_wav = Path(wav_path).resolve() != source.resolve()

        if prefer_local and os.getenv("DISABLE_LOCAL_WHISPER", "false").lower() != "true":
            try:
                transcript = _local_transcribe(wav_path)
                if transcript:
                    return transcript
                logger.warning("Local Whisper returned an empty transcript")
            except Exception as local_error:
                logger.warning("Local Whisper failed, trying Groq STT: %s", local_error)

        transcript = _groq_transcribe(wav_path)
        if transcript:
            return transcript

        raise RuntimeError("Speech-to-text returned an empty transcript")
    finally:
        if created_wav and wav_path and Path(wav_path).exists():
            Path(wav_path).unlink(missing_ok=True)


async def transcribe_audio(audio_url: str) -> str:
    """
    Backward-compatible URL transcription used by the Express API.
    Downloads the audio to a temp file and runs the same STT pipeline.
    """
    logger.info("Transcribing audio from URL: %s", audio_url)

    suffix = Path(audio_url.split("?")[0]).suffix or ".webm"
    tmp_path = None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(audio_url, timeout=60.0)
            response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        if Path(tmp_path).stat().st_size < 100:
            raise RuntimeError("Downloaded audio file is too small")

        loop = asyncio.get_running_loop()
        transcript = await loop.run_in_executor(
            None, lambda: transcribe_audio_file(tmp_path)
        )
        return transcript or "No speech detected"
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
