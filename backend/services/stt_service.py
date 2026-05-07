"""
Compatibility wrapper for the speech-to-text service.

Claude's suggested architecture imports:
    from backend.services.stt_service import transcribe

The main implementation lives in transcription.py, so this file exposes the
same simple API without duplicating the STT pipeline.
"""

from __future__ import annotations

from pathlib import Path

from backend.services.transcription import (
    _groq_transcribe,
    _local_transcribe,
    convert_to_wav,
)


def transcribe(audio_path: str) -> dict:
    """
    Transcribe an audio file with local faster-whisper first, then Groq fallback.
    Returns Claude-style metadata.
    """
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    if path.stat().st_size < 100:
        return {
            "transcript": "",
            "language": "en",
            "confidence": 0.0,
            "engine": "none",
        }

    wav_path = convert_to_wav(path)
    cleanup = Path(wav_path).resolve() != path.resolve()

    try:
        try:
            transcript = _local_transcribe(wav_path)
            return {
                "transcript": transcript,
                "language": "en",
                "confidence": 0.9 if transcript else 0.0,
                "engine": "faster-whisper",
            }
        except Exception:
            transcript = _groq_transcribe(wav_path)
            return {
                "transcript": transcript,
                "language": "en",
                "confidence": 0.95 if transcript else 0.0,
                "engine": "groq-whisper",
            }
    finally:
        if cleanup:
            Path(wav_path).unlink(missing_ok=True)
