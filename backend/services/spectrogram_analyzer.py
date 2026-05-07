"""
spectrogram_analyzer.py — Audio delivery analysis using librosa.
Extracts real audio features from WAV files:
- MFCC (Mel-frequency cepstral coefficients) for voice quality
- Spectral features for confidence/nervousness indicators
- Energy-based pause detection
- Zero crossing rate for stammer/fumble detection
- Pitch analysis for monotone vs expressive delivery
"""
import numpy as np
from utils.logger import setup_logger

logger = setup_logger(__name__)


def extract_audio_features(wav_path: str) -> dict:
    """
    Full spectrogram-based analysis of the audio file.
    Returns delivery quality metrics beyond just filler word counting.
    """
    try:
        import librosa
    except ImportError:
        logger.error("librosa not installed — returning empty features")
        return _empty_features()

    try:
        y, sr = librosa.load(wav_path, sr=16000, mono=True)
    except Exception as e:
        logger.error(f"Audio load failed: {e}")
        return _empty_features()

    duration = librosa.get_duration(y=y, sr=sr)
    if duration < 0.5:
        return _empty_features()

    # ── 1. MFCCs — captures voice quality and pronunciation patterns ──────────
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_variance = float(np.mean(np.std(mfccs, axis=1)))
    # High variance in MFCCs = more expressive/varied speech (good)
    # Very low variance = monotone delivery (flag this)
    expressiveness = min(10.0, mfcc_variance * 2)  # normalize to 0-10

    # ── 2. Spectral Centroid — brightness/clarity of voice ────────────────────
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    avg_centroid = float(np.mean(spectral_centroid))

    # ── 3. Zero Crossing Rate — detects fricatives, stammers ─────────────────
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    zcr_std = float(np.std(zcr))
    # High ZCR std = more speech irregularities (stammers, hesitations)
    stammer_indicator = min(10.0, zcr_std * 100)

    # ── 4. RMS Energy — pause detection ──────────────────────────────────────
    hop_length = 256
    rms = librosa.feature.rms(y=y, frame_length=512, hop_length=hop_length)[0]

    silence_threshold = float(np.percentile(rms, 15))
    is_silent = rms < silence_threshold

    pause_durations = []
    in_pause = False
    pause_start = 0
    MIN_PAUSE_FRAMES = int(0.4 * sr / hop_length)  # 0.4 second minimum

    for i, silent in enumerate(is_silent):
        if silent and not in_pause:
            in_pause = True
            pause_start = i
        elif not silent and in_pause:
            in_pause = False
            length_frames = i - pause_start
            if length_frames >= MIN_PAUSE_FRAMES:
                pause_sec = (length_frames * hop_length) / sr
                pause_durations.append(round(float(pause_sec), 2))

    pause_count = len(pause_durations)
    avg_pause = round(float(np.mean(pause_durations)), 2) if pause_durations else 0.0
    long_pauses = [p for p in pause_durations if p > 2.5]
    total_pause_sec = round(sum(pause_durations), 2)

    # Speaking vs total time ratio
    speaking_ratio = round(1.0 - (total_pause_sec / max(duration, 1)), 2)

    # ── 5. Pitch (F0) — detects monotone vs expressive delivery ──────────────
    try:
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr
        )
        voiced_f0 = f0[voiced_flag] if voiced_flag is not None else np.array([])
        pitch_std = float(np.std(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        # Higher pitch variation = more natural/expressive speech
        pitch_expressiveness = min(10.0, pitch_std / 20.0)
    except Exception:
        pitch_std = 0.0
        pitch_expressiveness = 5.0

    # ── 6. Score delivery ─────────────────────────────────────────────────────
    # Pause score: fewer long pauses = better
    if len(long_pauses) == 0 and pause_count <= 3:
        pause_score = 9.0
    elif len(long_pauses) <= 1 and pause_count <= 6:
        pause_score = 7.0
    elif len(long_pauses) <= 3:
        pause_score = 5.5
    else:
        pause_score = 3.5

    # Confidence score: combines pace, pauses, expressiveness
    confidence_score = round(
        (pause_score * 0.4) +
        (min(10.0, expressiveness) * 0.3) +
        (pitch_expressiveness * 0.3),
        1
    )

    return {
        # Pause metrics
        "pauseCount": pause_count,
        "avgPauseLengthSeconds": avg_pause,
        "longPauses": len(long_pauses),
        "totalPauseSeconds": total_pause_sec,
        "speakingRatio": speaking_ratio,
        # Voice quality
        "mfccVariance": round(mfcc_variance, 4),
        "expressiveness": round(expressiveness, 1),
        "pitchStd": round(pitch_std, 2),
        "pitchExpressiveness": round(pitch_expressiveness, 1),
        "spectralCentroid": round(avg_centroid, 1),
        # Stammer indicator
        "stammerIndicator": round(stammer_indicator, 2),
        "zeroCrossingStd": round(zcr_std, 4),
        # Composite scores
        "pauseScore": round(pause_score, 1),
        "confidenceScore": round(confidence_score, 1),
        "deliveryNote": _delivery_note(pause_count, len(long_pauses), pitch_expressiveness),
    }


def _delivery_note(pause_count: int, long_pauses: int, pitch_expr: float) -> str:
    notes = []
    if long_pauses > 2:
        notes.append(f"You had {long_pauses} long pauses — try to maintain flow.")
    if pause_count > 8:
        notes.append("Frequent hesitations detected. Practice smoother delivery.")
    if pitch_expr < 3.0:
        notes.append("Your delivery sounded monotone. Vary your pitch for engagement.")
    if not notes:
        notes.append("Good delivery rhythm and vocal variety.")
    return " ".join(notes)


def _empty_features() -> dict:
    return {
        "pauseCount": 0, "avgPauseLengthSeconds": 0.0, "longPauses": 0,
        "totalPauseSeconds": 0.0, "speakingRatio": 1.0,
        "mfccVariance": 0.0, "expressiveness": 5.0,
        "pitchStd": 0.0, "pitchExpressiveness": 5.0,
        "spectralCentroid": 0.0, "stammerIndicator": 0.0,
        "zeroCrossingStd": 0.0, "pauseScore": 5.0,
        "confidenceScore": 5.0, "deliveryNote": "Audio unavailable.",
    }
