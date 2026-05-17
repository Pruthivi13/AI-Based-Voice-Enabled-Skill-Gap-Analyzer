"""
Delivery analysis from audio plus transcript.

The evaluator uses a multi-signal heuristic model:
- lexical disfluency detection from transcript
- pause and speech-chunk structure from waveform silence analysis
- cadence and articulation from STT segments when available
- energy and pitch stability as confidence cues
"""
from __future__ import annotations

import math
import os
import re
import tempfile
from collections import defaultdict
from pathlib import Path
from statistics import mean, pstdev
from typing import Any

import numpy as np
from utils.logger import setup_logger

logger = setup_logger(__name__)

FILLER_PATTERNS = [
    {"phrase": "you know", "category": "discourse", "weight": 1.0},
    {"phrase": "i mean", "category": "repair", "weight": 1.15},
    {"phrase": "kind of", "category": "hedge", "weight": 0.9},
    {"phrase": "sort of", "category": "hedge", "weight": 0.9},
    {"phrase": "so yeah", "category": "bridge", "weight": 0.85},
    {"phrase": "to be honest", "category": "hedge", "weight": 0.95},
    {"phrase": "let me think", "category": "hesitation", "weight": 1.2},
    {"phrase": "how do i say", "category": "hesitation", "weight": 1.2},
    {"phrase": "you see", "category": "bridge", "weight": 0.8},
    {"phrase": "basically", "category": "bridge", "weight": 0.75},
    {"phrase": "actually", "category": "repair", "weight": 0.85},
    {"phrase": "literally", "category": "bridge", "weight": 0.75},
    {"phrase": "honestly", "category": "hedge", "weight": 0.8},
    {"phrase": "um", "category": "hesitation", "weight": 1.25},
    {"phrase": "uh", "category": "hesitation", "weight": 1.25},
    {"phrase": "erm", "category": "hesitation", "weight": 1.2},
    {"phrase": "hmm", "category": "hesitation", "weight": 1.05},
]

REPAIR_MARKERS = [
    "sorry",
    "rather",
    "let me rephrase",
    "what i mean",
    "correction",
]

CLAUSE_BREAK_PATTERN = re.compile(r"[.!?;:]+")


def clamp(value: float, minimum: float = 0.0, maximum: float = 10.0) -> float:
    return max(minimum, min(maximum, value))


def _safe_divide(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0.0
    return numerator / denominator


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9+#.-]+", text or ""))


def _tokenize_words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9+#.-]+", text.lower())


def _transcript_tokens(text: str) -> list[dict[str, Any]]:
    tokens = []
    for index, raw in enumerate(re.findall(r"[A-Za-z0-9+#.-]+|[.,!?;:-]+", text)):
        normalized = raw.lower()
        tokens.append(
            {
                "index": index,
                "raw": raw,
                "normalized": normalized,
                "is_word": bool(re.match(r"[A-Za-z0-9+#.-]+$", raw)),
            }
        )
    return tokens


def _word_only_tokens(tokens: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [token for token in tokens if token["is_word"]]


def _find_phrase_occurrences(
    word_tokens: list[dict[str, Any]],
    phrase_tokens: list[str],
) -> list[tuple[int, int]]:
    if not phrase_tokens:
        return []

    normalized_words = [token["normalized"] for token in word_tokens]
    matches: list[tuple[int, int]] = []
    phrase_len = len(phrase_tokens)
    for start in range(0, len(normalized_words) - phrase_len + 1):
        if normalized_words[start : start + phrase_len] == phrase_tokens:
            matches.append((start, start + phrase_len - 1))
    return matches


def _count_phrase(text: str, phrase: str) -> int:
    pattern = rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])"
    return len(re.findall(pattern, f" {text.lower()} "))


def scan_filler_words(transcript: str) -> dict[str, Any]:
    tokens = _transcript_tokens(transcript)
    word_tokens = _word_only_tokens(tokens)
    events: list[dict[str, Any]] = []
    occupied_word_positions: set[int] = set()

    for pattern in sorted(FILLER_PATTERNS, key=lambda item: len(item["phrase"]), reverse=True):
        phrase = pattern["phrase"]
        if phrase == "like":
            continue
        phrase_tokens = phrase.split()
        for start, end in _find_phrase_occurrences(word_tokens, phrase_tokens):
            if any(position in occupied_word_positions for position in range(start, end + 1)):
                continue
            for position in range(start, end + 1):
                occupied_word_positions.add(position)
            events.append(
                {
                    "phrase": phrase,
                    "category": pattern["category"],
                    "weight": pattern["weight"],
                    "start_word": start,
                    "end_word": end,
                }
            )

    normalized_words = [token["normalized"] for token in word_tokens]
    example_markers = {
        "methods",
        "method",
        "tools",
        "terms",
        "words",
        "things",
        "concepts",
        "layers",
        "models",
        "frameworks",
        "libraries",
        "such",
    }
    filler_previous = {"um", "uh", "erm", "so", "and", "but", "just", "well"}
    filler_next = {"i", "it", "you", "we", "kind", "sort", "um", "uh"}

    for index, word in enumerate(normalized_words):
        if index in occupied_word_positions:
            continue

        previous_word = normalized_words[index - 1] if index > 0 else ""
        next_word = normalized_words[index + 1] if index + 1 < len(normalized_words) else ""

        if word == "like":
            if previous_word in example_markers:
                continue
            if previous_word in filler_previous or next_word in filler_next:
                events.append(
                    {
                        "phrase": "like",
                        "category": "hesitation",
                        "weight": 0.85,
                        "start_word": index,
                        "end_word": index,
                    }
                )
                occupied_word_positions.add(index)

    events.sort(key=lambda item: (item["start_word"], item["end_word"]))
    counts_by_phrase: dict[str, int] = defaultdict(int)
    counts_by_category: dict[str, int] = defaultdict(int)
    weighted_total = 0.0
    for event in events:
        counts_by_phrase[event["phrase"]] += 1
        counts_by_category[event["category"]] += 1
        weighted_total += float(event["weight"])

    cluster_count = 0
    largest_cluster = 0
    if events:
        current_cluster = 1
        largest_cluster = 1
        for previous, current in zip(events, events[1:]):
            word_gap = current["start_word"] - previous["end_word"] - 1
            if word_gap <= 3:
                current_cluster += 1
            else:
                if current_cluster > 1:
                    cluster_count += 1
                largest_cluster = max(largest_cluster, current_cluster)
                current_cluster = 1
        if current_cluster > 1:
            cluster_count += 1
        largest_cluster = max(largest_cluster, current_cluster)

    return {
        "total": len(events),
        "weighted_total": round(weighted_total, 2),
        "by_phrase": dict(counts_by_phrase),
        "by_category": dict(counts_by_category),
        "cluster_count": cluster_count,
        "largest_cluster": largest_cluster,
        "events": events,
    }


def _count_repair_markers(transcript: str) -> dict[str, int]:
    found: dict[str, int] = {}
    for marker in REPAIR_MARKERS:
        count = _count_phrase(transcript, marker)
        if count:
            found[marker] = count
    return found


def _count_repeated_words(words: list[str]) -> int:
    repeats = 0
    for previous, current in zip(words, words[1:]):
        if previous == current and len(current) > 1:
            repeats += 1
    return repeats


def _count_restart_bigrams(words: list[str]) -> int:
    if len(words) < 4:
        return 0

    restarts = 0
    for index in range(len(words) - 3):
        if words[index] == words[index + 2] and words[index + 1] == words[index + 3]:
            restarts += 1
    return restarts


def _count_clause_fragments(transcript: str) -> int:
    fragments = [
        fragment.strip()
        for fragment in CLAUSE_BREAK_PATTERN.split(transcript)
        if fragment.strip()
    ]
    return sum(1 for fragment in fragments if 0 < _word_count(fragment) <= 2)


def _load_audio_segment(audio_path: str):
    from pydub import AudioSegment

    return AudioSegment.from_file(audio_path)


def _audio_to_temp_wav(audio_path: str) -> str:
    audio = _load_audio_segment(audio_path)
    audio = audio.set_channels(1).set_frame_rate(16000)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    audio.export(wav_path, format="wav")
    return wav_path


def _pause_metrics_with_pydub(audio_path: str) -> dict[str, Any]:
    from pydub.silence import detect_nonsilent, detect_silence

    audio = _load_audio_segment(audio_path)
    duration_seconds = len(audio) / 1000.0
    if duration_seconds <= 0:
        return {
            "duration_seconds": 0.0,
            "pause_count": 0,
            "long_pause_count": 0,
            "total_pause_seconds": 0.0,
            "average_pause_seconds": 0.0,
            "speech_seconds": 0.0,
            "speech_ratio": 0.0,
            "chunk_count": 0,
            "chunk_duration_std": 0.0,
            "chunk_duration_mean": 0.0,
            "pauses": [],
            "speech_chunks": [],
            "pause_detection_backend": "pydub",
        }

    base_dbfs = audio.dBFS if math.isfinite(audio.dBFS) else -40.0
    silence_threshold = float(os.getenv("PAUSE_SILENCE_DBFS", base_dbfs - 16))
    min_silence_ms = int(os.getenv("PAUSE_MIN_MS", "650"))
    long_pause_ms = int(os.getenv("LONG_PAUSE_MS", "1500"))
    min_chunk_ms = int(os.getenv("SPEECH_CHUNK_MIN_MS", "180"))

    raw_pauses = detect_silence(
        audio,
        min_silence_len=min_silence_ms,
        silence_thresh=silence_threshold,
    )
    raw_chunks = detect_nonsilent(
        audio,
        min_silence_len=min_chunk_ms,
        silence_thresh=silence_threshold,
    )

    pauses = []
    for start_ms, end_ms in raw_pauses:
        if start_ms < 300 or end_ms > len(audio) - 300:
            continue
        duration_ms = end_ms - start_ms
        pauses.append(
            {
                "start": round(start_ms / 1000.0, 2),
                "end": round(end_ms / 1000.0, 2),
                "duration": round(duration_ms / 1000.0, 2),
            }
        )

    speech_chunks = []
    for start_ms, end_ms in raw_chunks:
        if end_ms - start_ms < min_chunk_ms:
            continue
        speech_chunks.append(
            {
                "start": round(start_ms / 1000.0, 2),
                "end": round(end_ms / 1000.0, 2),
                "duration": round((end_ms - start_ms) / 1000.0, 2),
            }
        )

    total_pause_seconds = round(sum(item["duration"] for item in pauses), 2)
    speech_seconds = round(sum(item["duration"] for item in speech_chunks), 2)
    pause_count = len(pauses)
    long_pause_count = sum(
        1 for item in pauses if item["duration"] * 1000 >= long_pause_ms
    )
    average_pause_seconds = (
        round(total_pause_seconds / pause_count, 2) if pause_count else 0.0
    )
    chunk_durations = [chunk["duration"] for chunk in speech_chunks]
    chunk_duration_mean = round(mean(chunk_durations), 2) if chunk_durations else 0.0
    chunk_duration_std = (
        round(pstdev(chunk_durations), 2) if len(chunk_durations) > 1 else 0.0
    )

    return {
        "duration_seconds": round(duration_seconds, 2),
        "pause_count": pause_count,
        "long_pause_count": long_pause_count,
        "total_pause_seconds": total_pause_seconds,
        "average_pause_seconds": average_pause_seconds,
        "speech_seconds": speech_seconds,
        "speech_ratio": round(_safe_divide(speech_seconds, duration_seconds), 3),
        "chunk_count": len(speech_chunks),
        "chunk_duration_mean": chunk_duration_mean,
        "chunk_duration_std": chunk_duration_std,
        "pauses": pauses,
        "speech_chunks": speech_chunks,
        "pause_detection_backend": "pydub",
    }


def _empty_pause_metrics() -> dict[str, Any]:
    return {
        "duration_seconds": 0.0,
        "pause_count": 0,
        "long_pause_count": 0,
        "total_pause_seconds": 0.0,
        "average_pause_seconds": 0.0,
        "speech_seconds": 0.0,
        "speech_ratio": 0.0,
        "chunk_count": 0,
        "chunk_duration_std": 0.0,
        "chunk_duration_mean": 0.0,
        "pauses": [],
        "speech_chunks": [],
        "pause_detection_backend": "librosa",
    }


def _pause_metrics(audio_path: str) -> dict[str, Any]:
    wav_path = _audio_to_temp_wav(audio_path)
    try:
        import librosa

        samples, sample_rate = librosa.load(wav_path, sr=16000, mono=True)
        duration_seconds = float(librosa.get_duration(y=samples, sr=sample_rate))
        if duration_seconds <= 0 or samples.size == 0:
            return _empty_pause_metrics()

        frame_length = int(os.getenv("PAUSE_FRAME_LENGTH", "2048"))
        hop_length = int(os.getenv("PAUSE_HOP_LENGTH", "512"))
        top_db = float(os.getenv("PAUSE_TOP_DB", "30"))
        min_silence_seconds = int(os.getenv("PAUSE_MIN_MS", "650")) / 1000.0
        long_pause_seconds = int(os.getenv("LONG_PAUSE_MS", "1500")) / 1000.0
        min_chunk_seconds = int(os.getenv("SPEECH_CHUNK_MIN_MS", "180")) / 1000.0

        raw_intervals = librosa.effects.split(
            samples,
            top_db=top_db,
            frame_length=frame_length,
            hop_length=hop_length,
        )
        speech_chunks = []
        for start_sample, end_sample in raw_intervals:
            start = float(start_sample) / sample_rate
            end = float(end_sample) / sample_rate
            duration = max(0.0, end - start)
            if duration < min_chunk_seconds:
                continue
            speech_chunks.append(
                {
                    "start": round(start, 2),
                    "end": round(min(end, duration_seconds), 2),
                    "duration": round(duration, 2),
                }
            )

        pauses = []
        for previous, current in zip(speech_chunks, speech_chunks[1:]):
            start = float(previous["end"])
            end = float(current["start"])
            duration = max(0.0, end - start)
            if duration < min_silence_seconds:
                continue
            if start < 0.3 or end > duration_seconds - 0.3:
                continue
            pauses.append(
                {
                    "start": round(start, 2),
                    "end": round(end, 2),
                    "duration": round(duration, 2),
                }
            )

        total_pause_seconds = round(sum(item["duration"] for item in pauses), 2)
        speech_seconds = round(sum(item["duration"] for item in speech_chunks), 2)
        pause_count = len(pauses)
        long_pause_count = sum(
            1 for item in pauses if item["duration"] >= long_pause_seconds
        )
        chunk_durations = [chunk["duration"] for chunk in speech_chunks]

        return {
            "duration_seconds": round(duration_seconds, 2),
            "pause_count": pause_count,
            "long_pause_count": long_pause_count,
            "total_pause_seconds": total_pause_seconds,
            "average_pause_seconds": (
                round(total_pause_seconds / pause_count, 2) if pause_count else 0.0
            ),
            "speech_seconds": speech_seconds,
            "speech_ratio": round(_safe_divide(speech_seconds, duration_seconds), 3),
            "chunk_count": len(speech_chunks),
            "chunk_duration_mean": (
                round(mean(chunk_durations), 2) if chunk_durations else 0.0
            ),
            "chunk_duration_std": (
                round(pstdev(chunk_durations), 2)
                if len(chunk_durations) > 1
                else 0.0
            ),
            "pauses": pauses,
            "speech_chunks": speech_chunks,
            "pause_detection_backend": "librosa",
        }
    except Exception as error:
        logger.warning("librosa pause detection failed, falling back to pydub: %s", error)
        return _pause_metrics_with_pydub(audio_path)
    finally:
        if os.path.exists(wav_path):
            os.unlink(wav_path)


def _energy_metrics(audio_path: str) -> dict[str, float]:
    wav_path = _audio_to_temp_wav(audio_path)
    try:
        import librosa

        frame_length = 2048
        hop_length = 512
        samples, sample_rate = librosa.load(wav_path, sr=16000, mono=True)
        if samples.size == 0:
            return {
                "rms_mean": 0.0,
                "rms_std": 0.0,
                "energy_variation": 0.0,
                "voiced_ratio": 0.0,
                "pitch_median_hz": 0.0,
                "pitch_std_semitones": 0.0,
                "pitch_range_semitones": 0.0,
                **_parselmouth_voice_metrics(wav_path),
            }

        rms = librosa.feature.rms(
            y=samples, frame_length=frame_length, hop_length=hop_length
        )[0]
        rms_mean = float(np.mean(rms))
        rms_std = float(np.std(rms))
        energy_variation = rms_std / (rms_mean + 1e-8)

        voiced_threshold = max(rms_mean * 0.55, 0.01)
        voiced_mask = rms > voiced_threshold
        voiced_ratio = float(np.mean(voiced_mask)) if voiced_mask.size else 0.0

        pitch_values = librosa.yin(
            samples,
            fmin=75,
            fmax=320,
            sr=sample_rate,
            frame_length=frame_length,
            hop_length=hop_length,
        )
        pitch_values = np.asarray(pitch_values)
        finite_pitch = pitch_values[np.isfinite(pitch_values)]
        if voiced_mask.size and pitch_values.size == voiced_mask.size:
            finite_pitch = pitch_values[np.isfinite(pitch_values) & voiced_mask]

        if finite_pitch.size:
            median_pitch = float(np.median(finite_pitch))
            pitch_semitones = 12.0 * np.log2(finite_pitch / max(median_pitch, 1e-6))
            pitch_std = float(np.std(pitch_semitones))
            pitch_range = float(np.percentile(pitch_semitones, 90) - np.percentile(pitch_semitones, 10))
        else:
            median_pitch = 0.0
            pitch_std = 0.0
            pitch_range = 0.0

        return {
            "rms_mean": round(rms_mean, 5),
            "rms_std": round(rms_std, 5),
            "energy_variation": round(float(energy_variation), 3),
            "voiced_ratio": round(voiced_ratio, 3),
            "pitch_median_hz": round(median_pitch, 2),
            "pitch_std_semitones": round(pitch_std, 3),
            "pitch_range_semitones": round(pitch_range, 3),
            **_parselmouth_voice_metrics(wav_path),
        }
    except Exception as error:
        logger.warning("Energy metrics failed: %s", error)
        return {
            "rms_mean": 0.0,
            "rms_std": 0.0,
            "energy_variation": 0.0,
            "voiced_ratio": 0.0,
            "pitch_median_hz": 0.0,
            "pitch_std_semitones": 0.0,
            "pitch_range_semitones": 0.0,
            **_empty_parselmouth_metrics(),
        }
    finally:
        if os.path.exists(wav_path):
            os.unlink(wav_path)


def _empty_parselmouth_metrics() -> dict[str, float]:
    return {
        "parselmouth_available": 0.0,
        "jitter_local": 0.0,
        "shimmer_local": 0.0,
        "hnr_mean_db": 0.0,
        "praat_pitch_median_hz": 0.0,
        "praat_pitch_std_semitones": 0.0,
    }


def _parselmouth_voice_metrics(wav_path: str) -> dict[str, float]:
    try:
        import parselmouth
        from parselmouth.praat import call
    except Exception:
        return _empty_parselmouth_metrics()

    try:
        sound = parselmouth.Sound(wav_path)
        pitch = sound.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=320)
        pitch_values = pitch.selected_array["frequency"]
        pitch_values = pitch_values[pitch_values > 0]
        if pitch_values.size:
            median_pitch = float(np.median(pitch_values))
            pitch_semitones = 12.0 * np.log2(pitch_values / max(median_pitch, 1e-6))
            pitch_std = float(np.std(pitch_semitones))
        else:
            median_pitch = 0.0
            pitch_std = 0.0

        harmonicity = sound.to_harmonicity_cc(
            time_step=0.01,
            minimum_pitch=75,
            silence_threshold=0.1,
            periods_per_window=1.0,
        )
        hnr = float(call(harmonicity, "Get mean", 0, 0))
        if not math.isfinite(hnr):
            hnr = 0.0

        point_process = call([sound, pitch], "To PointProcess (cc)")
        jitter = float(
            call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
        )
        shimmer = float(
            call(
                [sound, point_process],
                "Get shimmer (local)",
                0,
                0,
                0.0001,
                0.02,
                1.3,
                1.6,
            )
        )
        if not math.isfinite(jitter):
            jitter = 0.0
        if not math.isfinite(shimmer):
            shimmer = 0.0

        return {
            "parselmouth_available": 1.0,
            "jitter_local": round(jitter, 5),
            "shimmer_local": round(shimmer, 5),
            "hnr_mean_db": round(hnr, 2),
            "praat_pitch_median_hz": round(median_pitch, 2),
            "praat_pitch_std_semitones": round(pitch_std, 3),
        }
    except Exception as error:
        logger.warning("Parselmouth voice metrics failed: %s", error)
        return _empty_parselmouth_metrics()


def _word_timing_metrics(segments: list[dict[str, Any]] | None) -> dict[str, Any]:
    words: list[dict[str, Any]] = []
    missing_word_timestamps = False
    for segment in segments or []:
        segment_words = segment.get("words", []) or []
        if not segment_words and str(segment.get("text", "")).strip():
            missing_word_timestamps = True
        for word in segment_words:
            start = float(word.get("start", 0.0))
            end = float(word.get("end", start))
            text = str(word.get("word", "")).strip()
            probability = float(word.get("probability", 0.0))
            if text:
                words.append(
                    {
                        "start": start,
                        "end": max(start, end),
                        "word": text,
                        "probability": probability,
                    }
                )

    words.sort(key=lambda item: item["start"])
    if not words:
        if missing_word_timestamps:
            logger.debug(
                "Segments missing word-level timestamps; delivery metrics will be estimate-only"
            )
        return {
            "word_timestamps_available": False,
            "timed_word_count": 0,
            "average_word_confidence": 0.0,
            "low_confidence_word_count": 0,
            "word_duration_mean": 0.0,
            "word_gap_mean": 0.0,
            "word_gap_std": 0.0,
            "micro_pause_count": 0,
            "long_word_gap_count": 0,
            "restart_gap_count": 0,
        }

    durations = [max(0.0, item["end"] - item["start"]) for item in words]
    probabilities = [
        item["probability"] for item in words if item.get("probability", 0.0) > 0
    ]
    gaps = [
        max(0.0, current["start"] - previous["end"])
        for previous, current in zip(words, words[1:])
    ]
    restart_gap_count = 0
    for previous, current in zip(words, words[1:]):
        gap = max(0.0, current["start"] - previous["end"])
        current_word = re.sub(r"[^a-z0-9]+", "", current["word"].lower())
        if gap >= 0.45 and len(current_word) <= 3:
            restart_gap_count += 1

    return {
        "word_timestamps_available": True,
        "timed_word_count": len(words),
        "average_word_confidence": round(mean(probabilities), 3) if probabilities else 0.0,
        "low_confidence_word_count": sum(
            1 for item in probabilities if 0 < item < 0.55
        ),
        "word_duration_mean": round(mean(durations), 3) if durations else 0.0,
        "word_gap_mean": round(mean(gaps), 3) if gaps else 0.0,
        "word_gap_std": round(pstdev(gaps), 3) if len(gaps) > 1 else 0.0,
        "micro_pause_count": sum(1 for gap in gaps if 0.25 <= gap < 0.65),
        "long_word_gap_count": sum(1 for gap in gaps if gap >= 0.65),
        "restart_gap_count": restart_gap_count,
    }


def _segment_metrics(segments: list[dict[str, Any]] | None) -> dict[str, Any]:
    if not segments:
        return {
            "segment_count": 0,
            "speech_seconds_from_segments": 0.0,
            "segment_words_mean": 0.0,
            "segment_duration_mean": 0.0,
            "articulation_rate_wps": 0.0,
            "cadence_variation": 0.0,
            "gap_mean": 0.0,
            "gap_std": 0.0,
            "short_segment_count": 0,
            "pause_before_short_segment_count": 0,
        }

    normalized = []
    for segment in segments:
        start = float(segment.get("start", 0.0))
        end = float(segment.get("end", start))
        text = str(segment.get("text", "")).strip()
        duration = max(0.0, end - start)
        word_count = _word_count(text)
        normalized.append(
            {
                "start": start,
                "end": end,
                "duration": duration,
                "text": text,
                "word_count": word_count,
            }
        )

    durations = [segment["duration"] for segment in normalized if segment["duration"] > 0]
    word_counts = [segment["word_count"] for segment in normalized]
    rates = [
        _safe_divide(segment["word_count"], segment["duration"])
        for segment in normalized
        if segment["duration"] > 0 and segment["word_count"] > 0
    ]
    gaps = []
    pause_before_short_segment_count = 0
    short_segment_count = 0
    for previous, current in zip(normalized, normalized[1:]):
        gap = max(0.0, current["start"] - previous["end"])
        gaps.append(gap)

    for index, segment in enumerate(normalized):
        is_short_segment = segment["word_count"] <= 3 and segment["duration"] <= 1.4
        if is_short_segment:
            short_segment_count += 1
            if index > 0:
                prior_gap = max(0.0, segment["start"] - normalized[index - 1]["end"])
                if prior_gap >= 0.8:
                    pause_before_short_segment_count += 1

    speech_seconds = sum(durations)
    return {
        "segment_count": len(normalized),
        "speech_seconds_from_segments": round(speech_seconds, 2),
        "segment_words_mean": round(mean(word_counts), 2) if word_counts else 0.0,
        "segment_duration_mean": round(mean(durations), 2) if durations else 0.0,
        "articulation_rate_wps": round(_safe_divide(sum(word_counts), speech_seconds), 3),
        "cadence_variation": round(_safe_divide(pstdev(rates), mean(rates)), 3) if len(rates) > 1 and mean(rates) > 0 else 0.0,
        "gap_mean": round(mean(gaps), 2) if gaps else 0.0,
        "gap_std": round(pstdev(gaps), 2) if len(gaps) > 1 else 0.0,
        "short_segment_count": short_segment_count,
        "pause_before_short_segment_count": pause_before_short_segment_count,
    }


def _pace_score(words_per_minute: float) -> tuple[float, str]:
    if words_per_minute <= 0:
        return 0.0, "no_speech"
    if words_per_minute < 90:
        return clamp(6.5 - ((90 - words_per_minute) / 20)), "slow"
    if words_per_minute > 180:
        return clamp(7.0 - ((words_per_minute - 180) / 25)), "fast"
    ideal = 135.0
    return clamp(10.0 - abs(words_per_minute - ideal) / 18), "balanced"


def _articulation_score(articulation_rate_wps: float) -> float:
    if articulation_rate_wps <= 0:
        return 0.0
    if articulation_rate_wps < 2.0:
        return clamp(6.0 - ((2.0 - articulation_rate_wps) * 2.5))
    if articulation_rate_wps > 4.4:
        return clamp(7.0 - ((articulation_rate_wps - 4.4) * 2.0))
    ideal = 3.1
    return clamp(10.0 - abs(articulation_rate_wps - ideal) * 2.2)


def _speech_ratio_score(speech_ratio: float) -> float:
    if speech_ratio <= 0:
        return 0.0
    ideal = 0.8
    return clamp(10.0 - abs(speech_ratio - ideal) * 22)


def _cadence_score(cadence_variation: float) -> float:
    return clamp(9.5 - cadence_variation * 8.5)


def _pitch_stability_score(energy: dict[str, float]) -> float:
    pitch_std = float(
        energy.get("praat_pitch_std_semitones")
        or energy.get("pitch_std_semitones", 0.0)
    )
    pitch_range = float(energy.get("pitch_range_semitones", 0.0))
    voiced_ratio = float(energy.get("voiced_ratio", 0.0))
    return clamp(
        8.5
        + voiced_ratio * 2.0
        - max(0.0, pitch_std - 2.6) * 1.2
        - max(0.0, pitch_range - 9.0) * 0.18
    )


def _energy_score(energy: dict[str, float]) -> float:
    rms_mean = float(energy.get("rms_mean", 0.0))
    energy_variation = float(energy.get("energy_variation", 0.0))
    voiced_ratio = float(energy.get("voiced_ratio", 0.0))
    return clamp(
        7.2
        + min(energy_variation, 1.0) * 1.1
        + voiced_ratio * 1.6
        - max(0.0, 0.08 - rms_mean) * 18.0
    )


def _voice_quality_score(energy: dict[str, float]) -> float:
    if not energy.get("parselmouth_available"):
        return _pitch_stability_score(energy)

    jitter = float(energy.get("jitter_local", 0.0))
    shimmer = float(energy.get("shimmer_local", 0.0))
    hnr = float(energy.get("hnr_mean_db", 0.0))
    pitch_score = _pitch_stability_score(energy)
    return clamp(
        pitch_score * 0.45
        + clamp(10.0 - max(0.0, jitter - 0.012) * 260.0) * 0.20
        + clamp(10.0 - max(0.0, shimmer - 0.055) * 90.0) * 0.15
        + clamp(5.5 + min(max(hnr, 0.0), 24.0) / 24.0 * 4.5) * 0.20
    )


def _hesitation_metrics(
    transcript: str,
    filler_result: dict[str, Any],
    pause_result: dict[str, Any],
    segment_result: dict[str, Any],
    word_timing_result: dict[str, Any],
) -> dict[str, Any]:
    words = _tokenize_words(transcript)
    repeated_word_count = _count_repeated_words(words)
    repeated_bigram_count = _count_restart_bigrams(words)
    clause_fragment_count = _count_clause_fragments(transcript)
    repair_markers = _count_repair_markers(transcript)
    self_correction_count = sum(repair_markers.values())

    filler_cluster_count = int(filler_result.get("cluster_count", 0))
    pause_before_short_segment_count = int(
        segment_result.get("pause_before_short_segment_count", 0)
    )
    short_segment_count = int(segment_result.get("short_segment_count", 0))
    micro_pause_count = int(word_timing_result.get("micro_pause_count", 0))
    long_word_gap_count = int(word_timing_result.get("long_word_gap_count", 0))
    restart_gap_count = int(word_timing_result.get("restart_gap_count", 0))
    low_confidence_word_count = int(
        word_timing_result.get("low_confidence_word_count", 0)
    )

    weighted_hesitation_load = (
        repeated_word_count * 1.0
        + repeated_bigram_count * 1.35
        + self_correction_count * 1.1
        + filler_cluster_count * 1.0
        + pause_before_short_segment_count * 1.15
        + min(micro_pause_count, 8) * 0.18
        + long_word_gap_count * 0.45
        + restart_gap_count * 0.7
        + min(low_confidence_word_count, 8) * 0.12
        + max(0, short_segment_count - 1) * 0.35
        + clause_fragment_count * 0.5
    )
    hesitation_score = clamp(10.0 - weighted_hesitation_load)

    return {
        "repeated_word_count": repeated_word_count,
        "repeated_bigram_count": repeated_bigram_count,
        "self_correction_count": self_correction_count,
        "repair_markers": repair_markers,
        "clause_fragment_count": clause_fragment_count,
        "filler_cluster_count": filler_cluster_count,
        "pause_before_short_segment_count": pause_before_short_segment_count,
        "micro_pause_count": micro_pause_count,
        "long_word_gap_count": long_word_gap_count,
        "restart_gap_count": restart_gap_count,
        "low_confidence_word_count": low_confidence_word_count,
        "short_segment_count": short_segment_count,
        "hesitation_score": round(hesitation_score, 2),
    }


def analyze_audio(
    audio_path: str | None,
    transcript: str,
    stt_segments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    has_audio = bool(audio_path)
    words = _word_count(transcript)
    filler_result = scan_filler_words(transcript)

    if not audio_path:
        pause_result = {
            "duration_seconds": 0.0,
            "pause_count": 0,
            "long_pause_count": 0,
            "total_pause_seconds": 0.0,
            "average_pause_seconds": 0.0,
            "speech_seconds": 0.0,
            "speech_ratio": 0.0,
            "chunk_count": 0,
            "chunk_duration_mean": 0.0,
            "chunk_duration_std": 0.0,
            "pauses": [],
            "speech_chunks": [],
        }
        energy = {
            "rms_mean": 0.0,
            "rms_std": 0.0,
            "energy_variation": 0.0,
            "voiced_ratio": 0.0,
            "pitch_median_hz": 0.0,
            "pitch_std_semitones": 0.0,
            "pitch_range_semitones": 0.0,
            **_empty_parselmouth_metrics(),
        }
    else:
        audio_file = Path(audio_path)
        if not audio_file.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        try:
            pause_result = _pause_metrics(audio_path)
            energy = _energy_metrics(audio_path)
        except Exception as error:
            logger.warning("Audio feature extraction failed: %s", error)
            pause_result = {
                "duration_seconds": 0.0,
                "pause_count": 0,
                "long_pause_count": 0,
                "total_pause_seconds": 0.0,
                "average_pause_seconds": 0.0,
                "speech_seconds": 0.0,
                "speech_ratio": 0.0,
                "chunk_count": 0,
                "chunk_duration_mean": 0.0,
                "chunk_duration_std": 0.0,
                "pauses": [],
                "speech_chunks": [],
            }
            energy = {
                "rms_mean": 0.0,
                "rms_std": 0.0,
                "energy_variation": 0.0,
                "voiced_ratio": 0.0,
                "pitch_median_hz": 0.0,
                "pitch_std_semitones": 0.0,
                "pitch_range_semitones": 0.0,
                **_empty_parselmouth_metrics(),
            }

    duration_seconds = float(pause_result["duration_seconds"])
    segment_result = _segment_metrics(stt_segments)
    word_timing_result = _word_timing_metrics(stt_segments)
    hesitation = _hesitation_metrics(
        transcript,
        filler_result=filler_result,
        pause_result=pause_result,
        segment_result=segment_result,
        word_timing_result=word_timing_result,
    )

    speech_seconds = float(pause_result.get("speech_seconds") or 0.0)
    if has_audio and speech_seconds > 0:
        wpm_duration_seconds = speech_seconds
        words_per_minute_basis = "speech_seconds"
    elif has_audio and duration_seconds > 0:
        wpm_duration_seconds = duration_seconds
        words_per_minute_basis = "audio_duration_seconds_fallback"
    else:
        wpm_duration_seconds = 0.0
        words_per_minute_basis = "not_available"

    words_per_minute = (
        round((words / wpm_duration_seconds) * 60, 1)
        if wpm_duration_seconds > 0
        else 0.0
    )
    words_per_minute = min(words_per_minute, 300.0)
    filler_ratio = round(filler_result["total"] / max(words, 1), 3)
    weighted_filler_ratio = round(
        filler_result["weighted_total"] / max(words, 1), 3
    )
    pause_burden = (
        pause_result["total_pause_seconds"] / duration_seconds
        if duration_seconds > 0
        else 0.0
    )

    if not has_audio:
        pace_score, pace_label = 0.0, "not_available"
        articulation_score = 0.0
        speech_ratio_score = 0.0
        cadence_score = 0.0
        pitch_stability_score = 0.0
        energy_score = 0.0
        voice_quality_score = 0.0
    else:
        pace_score, pace_label = _pace_score(words_per_minute)
        articulation_score = _articulation_score(
            segment_result["articulation_rate_wps"]
        )
        speech_ratio_score = _speech_ratio_score(pause_result["speech_ratio"])
        cadence_score = _cadence_score(segment_result["cadence_variation"])
        pitch_stability_score = _pitch_stability_score(energy)
        energy_score = _energy_score(energy)
        voice_quality_score = _voice_quality_score(energy)

    if not has_audio:
        pause_score = 0.0
        filler_score = 0.0
        fluency_score = 0.0
        confidence_cue_score = 0.0
        delivery_score = 0.0
    else:
        pause_score = clamp(
            10.0
            - pause_result["long_pause_count"] * 1.2
            - pause_result["pause_count"] * 0.3
            - pause_burden * 6.5
            - max(0, hesitation["pause_before_short_segment_count"] - 1) * 0.5
        )
        filler_score = clamp(
            10.0
            - filler_result["weighted_total"] * 0.65
            - weighted_filler_ratio * 38
            - filler_result["cluster_count"] * 0.65
        )
        fluency_score = round(
            (
                pause_score * 0.30
                + filler_score * 0.25
                + hesitation["hesitation_score"] * 0.25
                + cadence_score * 0.20
            ),
            2,
        )
        confidence_cue_score = round(
            (
                fluency_score * 0.35
                + energy_score * 0.20
                + voice_quality_score * 0.15
                + articulation_score * 0.15
                + speech_ratio_score * 0.15
            ),
            2,
        )
        delivery_score = round(
            (
                pace_score * 0.15
                + pause_score * 0.20
                + filler_score * 0.15
                + hesitation["hesitation_score"] * 0.20
                + fluency_score * 0.10
                + confidence_cue_score * 0.20
            ),
            2,
        )

    return {
        "audio_available": has_audio,
        "duration_seconds": duration_seconds,
        "word_count": words,
        "words_per_minute": words_per_minute,
        "words_per_minute_basis": words_per_minute_basis,
        "pace_label": pace_label,
        "pause_count": pause_result["pause_count"],
        "long_pause_count": pause_result["long_pause_count"],
        "total_pause_seconds": pause_result["total_pause_seconds"],
        "average_pause_seconds": pause_result["average_pause_seconds"],
        "speech_seconds": pause_result["speech_seconds"],
        "speech_ratio": pause_result["speech_ratio"],
        "pause_detection_backend": pause_result.get("pause_detection_backend"),
        "speech_chunks": pause_result["speech_chunks"],
        "filler_count": filler_result["total"],
        "filler_weighted_total": filler_result["weighted_total"],
        "filler_words": filler_result["by_phrase"],
        "filler_categories": filler_result["by_category"],
        "filler_cluster_count": filler_result["cluster_count"],
        "largest_filler_cluster": filler_result["largest_cluster"],
        "filler_ratio": filler_ratio,
        "weighted_filler_ratio": weighted_filler_ratio,
        "hesitation": {
            key: value
            for key, value in hesitation.items()
            if key != "hesitation_score"
        },
        "repeated_start_count": hesitation["repeated_word_count"],
        "segment_metrics": segment_result,
        "word_timing_metrics": word_timing_result,
        "energy": energy,
        "scores": {
            "pace": round(pace_score, 2),
            "pause_control": round(pause_score, 2),
            "filler_control": round(filler_score, 2),
            "hesitation_control": 0.0 if not has_audio else hesitation["hesitation_score"],
            "cadence_control": round(cadence_score, 2),
            "articulation": round(articulation_score, 2),
            "voice_quality": round(voice_quality_score, 2),
            "fluency": fluency_score,
            "confidence_cues": confidence_cue_score,
            "delivery": delivery_score,
        },
    }
