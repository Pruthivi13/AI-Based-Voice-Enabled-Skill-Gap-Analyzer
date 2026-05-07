"""
Delivery analysis using pydub and librosa.

The LLM judges meaning; this module judges timing and voice-delivery signals.
"""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np

from backend.services.transcription import convert_to_wav
from utils.logger import setup_logger

logger = setup_logger(__name__)

FILLER_PATTERNS = [
    r"\bum+\b",
    r"\buh+\b",
    r"\ber+\b",
    r"\bah+\b",
    r"\blike\b",
    r"\byou know\b",
    r"\bbasically\b",
    r"\bactually\b",
    r"\bliterally\b",
    r"\bkind of\b",
    r"\bsort of\b",
]


def count_filler_words(transcript: str) -> int:
    text = (transcript or "").lower()
    return sum(len(re.findall(pattern, text)) for pattern in FILLER_PATTERNS)


def count_repeated_starts(transcript: str) -> int:
    words = re.findall(r"\b[a-zA-Z']+\b", (transcript or "").lower())
    repeats = 0
    for first, second in zip(words, words[1:]):
        if len(first) > 2 and first == second:
            repeats += 1
    return repeats


def _score_pace(wpm: int) -> float:
    if 120 <= wpm <= 160:
        return 10.0
    if 100 <= wpm < 120 or 160 < wpm <= 180:
        return 8.0
    if 80 <= wpm < 100 or 180 < wpm <= 210:
        return 6.0
    if wpm == 0:
        return 4.0
    return 4.5


def _score_fillers(filler_count: int, word_count: int) -> float:
    if word_count <= 0:
        return 5.0
    ratio = filler_count / max(word_count, 1)
    if ratio <= 0.015:
        return 9.0
    if ratio <= 0.04:
        return 7.5
    if ratio <= 0.08:
        return 6.0
    return 4.0


def _pause_metrics_with_pydub(wav_path: str) -> dict:
    try:
        from pydub import AudioSegment, silence
        try:
            import imageio_ffmpeg

            AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            pass

        audio = AudioSegment.from_file(wav_path)
        duration = len(audio) / 1000.0
        silence_threshold = max(audio.dBFS - 16, -50)
        silent_ranges = silence.detect_silence(
            audio,
            min_silence_len=450,
            silence_thresh=silence_threshold,
        )
        pauses = [round((end - start) / 1000.0, 2) for start, end in silent_ranges]
        long_pauses = [pause for pause in pauses if pause >= 2.0]
        total_pause = round(sum(pauses), 2)
        speaking_ratio = round(max(0.0, 1.0 - (total_pause / max(duration, 1.0))), 2)
        return {
            "durationSeconds": round(duration, 2),
            "pauseCount": len(pauses),
            "longPauseCount": len(long_pauses),
            "averagePauseSeconds": round(float(np.mean(pauses)), 2) if pauses else 0.0,
            "totalPauseSeconds": total_pause,
            "speakingRatio": speaking_ratio,
        }
    except Exception as exc:
        logger.warning("pydub pause analysis failed: %s", exc)
        return {}


def _librosa_features(wav_path: str) -> dict:
    try:
        import librosa

        y, sr = librosa.load(wav_path, sr=16000, mono=True)
        duration = float(librosa.get_duration(y=y, sr=sr))
        if duration <= 0:
            return {}

        rms = librosa.feature.rms(y=y)[0]
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]

        try:
            f0, voiced_flag, _ = librosa.pyin(
                y,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"),
                sr=sr,
            )
            voiced_f0 = f0[voiced_flag] if voiced_flag is not None else np.array([])
            pitch_std = float(np.nanstd(voiced_f0)) if len(voiced_f0) else 0.0
        except Exception:
            pitch_std = 0.0

        energy_variation = float(np.std(rms) / (np.mean(rms) + 1e-8))
        expressiveness = min(10.0, max(3.0, energy_variation * 4 + pitch_std / 25))
        stammer_indicator = min(10.0, float(np.std(zcr)) * 120)

        return {
            "durationSeconds": round(duration, 2),
            "energyVariation": round(energy_variation, 3),
            "expressiveness": round(expressiveness, 1),
            "pitchStd": round(pitch_std, 2),
            "spectralCentroid": round(float(np.mean(spectral_centroid)), 1),
            "mfccVariance": round(float(np.mean(np.std(mfcc, axis=1))), 4),
            "stammerIndicator": round(stammer_indicator, 2),
        }
    except Exception as exc:
        logger.warning("librosa feature analysis failed: %s", exc)
        return {}


def analyze_delivery(
    audio_path: str | Path | None,
    transcript: str,
    duration_seconds: Optional[float] = None,
) -> dict:
    transcript = transcript or ""
    word_count = len(re.findall(r"\b[\w']+\b", transcript))
    filler_count = count_filler_words(transcript)
    repeated_starts = count_repeated_starts(transcript)

    wav_path = None
    created_wav = False
    metrics: dict = {}

    try:
        if audio_path and Path(audio_path).exists():
            wav_path = convert_to_wav(audio_path)
            created_wav = Path(wav_path).resolve() != Path(audio_path).resolve()
            metrics.update(_pause_metrics_with_pydub(wav_path))
            metrics.update(_librosa_features(wav_path))
    finally:
        if created_wav and wav_path:
            Path(wav_path).unlink(missing_ok=True)

    duration = float(
        duration_seconds
        or metrics.get("durationSeconds")
        or max(1.0, word_count / 2.2)
    )
    wpm = int(round((word_count / max(duration, 1.0)) * 60))

    pause_count = int(metrics.get("pauseCount", 0))
    long_pause_count = int(
        metrics.get("longPauseCount", metrics.get("longPauses", 0))
    )

    pace_score = _score_pace(wpm)
    filler_score = _score_fillers(filler_count, word_count)

    if long_pause_count == 0 and pause_count <= 4:
        pause_score = 9.0
    elif long_pause_count <= 1 and pause_count <= 7:
        pause_score = 7.5
    elif long_pause_count <= 3:
        pause_score = 5.5
    else:
        pause_score = 4.0

    expressiveness = float(metrics.get("expressiveness", 6.0))
    fluency_score = round(
        pause_score * 0.35
        + filler_score * 0.3
        + pace_score * 0.25
        + max(0.0, 10.0 - repeated_starts) * 0.1,
        1,
    )
    delivery_score = round(
        pace_score * 0.25
        + pause_score * 0.25
        + filler_score * 0.2
        + fluency_score * 0.2
        + expressiveness * 0.1,
        1,
    )

    note_parts = []
    if wpm < 100:
        note_parts.append("Pace is slightly slow.")
    elif wpm > 180:
        note_parts.append("Pace is fast; slow down for clarity.")
    else:
        note_parts.append("Pace is in a comfortable range.")
    if long_pause_count:
        note_parts.append(f"{long_pause_count} long pause(s) detected.")
    if filler_count:
        note_parts.append(f"{filler_count} filler word(s) detected.")

    return {
        **metrics,
        "wordCount": word_count,
        "wordsPerMinute": wpm,
        "speechRateWpm": wpm,
        "pauseCount": pause_count,
        "longPauseCount": long_pause_count,
        "fillerWordCount": filler_count,
        "repeatedStartCount": repeated_starts,
        "paceScore": round(pace_score, 1),
        "pauseScore": round(pause_score, 1),
        "fillerScore": round(filler_score, 1),
        "fluencyScore": fluency_score,
        "confidenceScore": delivery_score,
        "deliveryScore": delivery_score,
        "deliveryFeedback": " ".join(note_parts),
        # Claude-style aliases used by the standalone architecture notes.
        "word_count": word_count,
        "words_per_minute": wpm,
        "filler_word_count": filler_count,
        "pause_count": pause_count,
        "long_pause_count": long_pause_count,
        "pace_score": round(pace_score, 1),
        "fluency_score": fluency_score,
        "delivery_score": delivery_score,
        "delivery_feedback": note_parts,
    }
