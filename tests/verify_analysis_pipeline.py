"""
No-frontend verification for the interview analysis pipeline.

Run:
  ./venv/bin/python tests/verify_analysis_pipeline.py
"""
from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / "backend" / ".env")

if os.getenv("GROQ_API_KEY"):
    os.environ["LLM_PROVIDER_ORDER"] = "groq,gemini"
    os.environ.setdefault("STT_PROVIDER", "groq")
os.environ.setdefault("LLM_MAX_RETRIES", "0")

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402
from backend.services.audio_analysis import analyze_audio  # noqa: E402


client = TestClient(app)


def expect(condition: bool, label: str) -> None:
    if not condition:
        raise AssertionError(label)
    print(f"[ok] {label}")


def show(name: str, value) -> None:
    print(f"[info] {name}: {value}")


def verify_transcript_endpoint() -> dict:
    response = client.post(
        "/api/analyze-answer",
        data={
            "question_id": "verify_rest_transcript",
            "question_text": "Explain REST APIs.",
            "transcript": (
                "REST APIs are stateless HTTP interfaces. They expose resources "
                "through URLs and use methods like GET, POST, PUT, and DELETE."
            ),
            "expected_keywords": json.dumps(
                ["REST", "stateless", "HTTP", "resources", "GET", "POST"]
            ),
            "expected_key_points": json.dumps(
                [
                    "REST is stateless",
                    "REST exposes resources",
                    "REST uses HTTP methods",
                ]
            ),
            "ideal_answer": (
                "A REST API is stateless, exposes resources through URLs, and "
                "uses standard HTTP methods such as GET, POST, PUT, and DELETE."
            ),
            "user_id": "verify_cli",
            "response_id": "verify_transcript_response",
        },
    )
    expect(response.status_code == 200, "transcript endpoint returns HTTP 200")
    body = response.json()
    keyword_analysis = body["keyword_analysis"]
    content_model = body["content_model_evaluation"]

    expect(keyword_analysis["keyword_score"] >= 8.0, "expected keywords are scored")
    expect(keyword_analysis["concept_score"] >= 8.0, "expected key points are scored")
    expect(body["content_scores"]["relevance"] > 0, "LLM/rubric content score exists")
    expect(body["content_model_score"] is not None, "content_scorer contributes a score")
    expect(
        content_model["scorer_backend"] in {"transformer", "local_semantic"},
        "content_scorer backend is explicit",
    )
    expect(body["audio_metrics"]["audio_available"] is False, "transcript-only call marks audio unavailable")

    provider = body.get("llm_provider")
    show("transcript llm_provider", provider)
    if os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
        expect(provider != "heuristic_fallback", "live LLM provider was used")

    return body


def verify_internal_legacy_endpoint() -> dict:
    response = client.post(
        "/internal/analyze-response",
        json={
            "responseId": "verify_internal_response",
            "transcript": (
                "REST APIs are stateless HTTP interfaces that expose resources "
                "through URLs and use GET and POST methods."
            ),
            "questionText": "Explain REST APIs.",
            "expectedKeywords": ["REST", "stateless", "HTTP", "resources"],
            "expectedKeyPoints": ["REST is stateless", "REST exposes resources"],
            "idealAnswer": "A REST API is stateless, resource-oriented, and uses HTTP methods.",
        },
    )
    expect(response.status_code == 200, "legacy internal endpoint returns HTTP 200")
    body = response.json()
    pipeline = body.get("pipelineResult", {})
    expect("content_scores" in pipeline, "legacy analyzer returns pipeline content scores")
    expect("content_model_evaluation" in pipeline, "legacy analyzer includes content_scorer output")
    show("legacy llm_provider", pipeline.get("llm_provider"))
    return body


def verify_audio_metrics() -> dict:
    sample_rate = 16000
    first_chunk = 0.2 * np.sin(
        2 * math.pi * 220 * np.arange(int(sample_rate * 1.0)) / sample_rate
    )
    pause = np.zeros(int(sample_rate * 0.9))
    second_chunk = 0.2 * np.sin(
        2 * math.pi * 220 * np.arange(int(sample_rate * 1.0)) / sample_rate
    )
    samples = np.concatenate([first_chunk, pause, second_chunk])

    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        with wave.open(wav_path, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes((samples * 32767).astype(np.int16).tobytes())

        result = analyze_audio(
            wav_path,
            "one two three four five six seven eight nine ten",
        )
    finally:
        os.unlink(wav_path)

    expect(result["audio_available"] is True, "audio metrics see an audio file")
    expect(result["pause_detection_backend"] == "librosa", "pause detection uses librosa")
    expect(result["pause_count"] >= 1, "pause detector finds the injected pause")
    expect(result["words_per_minute_basis"] == "speech_seconds", "WPM uses detected speech duration")
    expect(result["words_per_minute"] > 0, "WPM is nonzero for audio")
    show(
        "audio summary",
        {
            "duration_seconds": result["duration_seconds"],
            "words_per_minute": result["words_per_minute"],
            "pause_count": result["pause_count"],
            "delivery": result["scores"]["delivery"],
        },
    )
    return result


def verify_real_spoken_audio_endpoint() -> dict | None:
    if not os.getenv("GROQ_API_KEY"):
        show("real spoken endpoint", "skipped; GROQ_API_KEY is not configured")
        return None
    if not shutil.which("say") or not shutil.which("ffmpeg"):
        show("real spoken endpoint", "skipped; macOS say or ffmpeg is unavailable")
        return None

    spoken_text = (
        "REST APIs are stateless HTTP interfaces. They expose resources "
        "through URLs and use GET and POST methods."
    )

    with tempfile.TemporaryDirectory() as tmp_dir:
        aiff_path = Path(tmp_dir) / "spoken.aiff"
        wav_path = Path(tmp_dir) / "spoken.wav"
        subprocess.run(
            ["say", "-o", str(aiff_path), spoken_text],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(aiff_path),
                "-ar",
                "16000",
                "-ac",
                "1",
                "-y",
                str(wav_path),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        with wav_path.open("rb") as handle:
            response = client.post(
                "/api/analyze-answer",
                data={
                    "question_id": "verify_real_audio",
                    "question_text": "Explain REST APIs.",
                    "expected_keywords": json.dumps(
                        ["REST", "stateless", "HTTP", "resources", "GET", "POST"]
                    ),
                    "expected_key_points": json.dumps(
                        ["REST is stateless", "REST exposes resources"]
                    ),
                    "ideal_answer": (
                        "A REST API is stateless, exposes resources through URLs, "
                        "and uses HTTP methods."
                    ),
                    "user_id": "verify_cli",
                    "response_id": "verify_real_audio_response",
                },
                files={"audio": ("spoken.wav", handle, "audio/wav")},
            )

    expect(response.status_code == 200, "real spoken audio endpoint returns HTTP 200")
    body = response.json()
    audio = body["audio_metrics"]
    expect(audio["audio_available"] is True, "real audio endpoint marks audio available")
    expect(audio["words_per_minute_basis"] == "speech_seconds", "real audio endpoint WPM uses speech duration")
    expect(audio["words_per_minute"] > 0, "real audio endpoint produces WPM")
    expect(audio["pause_detection_backend"] == "librosa", "real audio endpoint uses librosa pause detection")
    expect(body["stt"]["provider"] != "provided_transcript", "real audio endpoint runs STT")
    expect(body["transcript"] != "No speech detected", "real audio endpoint gets speech transcript")
    show(
        "real audio summary",
        {
            "stt_provider": body["stt"].get("provider"),
            "llm_provider": body.get("llm_provider"),
            "duration_seconds": audio["duration_seconds"],
            "words_per_minute": audio["words_per_minute"],
            "pause_backend": audio["pause_detection_backend"],
        },
    )
    return body


def main() -> None:
    print("Verifying analysis pipeline without the frontend...\n")
    verify_transcript_endpoint()
    verify_internal_legacy_endpoint()
    verify_audio_metrics()
    verify_real_spoken_audio_endpoint()
    print("\nAll no-frontend verification checks passed.")


if __name__ == "__main__":
    main()
