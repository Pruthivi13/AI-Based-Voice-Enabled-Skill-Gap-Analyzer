"""
Heavy stretch test for the AI interview evaluator pipeline.

This test is intentionally deterministic and credit-safe:
- It disables Gemini/Groq calls so no paid/free-tier quota is consumed.
- It verifies the local fallback path, API contract, keyword extraction,
  audio analysis, and full orchestration.
- STT model loading is not forced here because downloading Whisper weights can
  take several minutes; the stt_service small-file path is still sanity checked.
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import tempfile
import wave
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient

import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ["GEMINI_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""
os.environ["ENABLE_SENTENCE_TRANSFORMERS"] = "false"

from backend.main import app
from backend.services.audio_analysis import analyze_delivery
from backend.services.keyword_extractor import extract_keywords
from backend.services.llm_service import evaluate_answer
from backend.services.pipeline import analyze_answer_pipeline
from backend.services.question_bank import get_question, load_questions
from backend.services.stt_service import transcribe


RESULTS: list[tuple[str, str, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append(("PASS" if ok else "FAIL", name, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" - {detail}" if detail else ""))


def record_warn(name: str, detail: str) -> None:
    RESULTS.append(("WARN", name, detail))
    print(f"[WARN] {name} - {detail}")


def check_dependencies() -> None:
    packages = [
        "fastapi",
        "uvicorn",
        "faster_whisper",
        "groq",
        "google.generativeai",
        "spacy",
        "nltk",
        "librosa",
        "pydub",
        "soundfile",
        "numpy",
        "httpx",
        "multipart",
    ]
    for package in packages:
        try:
            __import__(package)
            record(f"import {package}", True)
        except Exception as exc:
            record(f"import {package}", False, str(exc))

    try:
        import spacy

        spacy.load("en_core_web_sm")
        record("spaCy model en_core_web_sm", True)
    except Exception as exc:
        record_warn("spaCy model en_core_web_sm", f"not loaded; regex/blank fallback will be used ({exc})")

    try:
        from backend.services.transcription import _ffmpeg_executable

        ffmpeg_path = _ffmpeg_executable()
        record("ffmpeg resolver", bool(ffmpeg_path and Path(ffmpeg_path).exists()), str(ffmpeg_path))
    except Exception as exc:
        record("ffmpeg resolver", False, str(exc))


def make_synthetic_wav() -> str:
    sr = 16000
    duration = 8.0
    samples = int(sr * duration)
    signal = np.zeros(samples, dtype=np.float32)

    for start, end, freq in [(0.0, 2.5, 190), (3.4, 5.7, 230), (6.3, 8.0, 210)]:
        a = int(start * sr)
        b = int(end * sr)
        t = np.arange(b - a) / sr
        signal[a:b] = 0.28 * np.sin(2 * math.pi * freq * t) + 0.015 * np.random.randn(b - a)

    path = Path(tempfile.gettempdir()) / "interview_stretch_synthetic.wav"
    pcm = np.clip(signal * 32767, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())
    return str(path)


def test_question_bank() -> None:
    questions = load_questions()
    record("question bank loads", len(questions) == 5, f"{len(questions)} questions")
    q2 = get_question("q2")
    record(
        "question q2 schema",
        bool(q2 and q2.get("question_text") and q2.get("expected_keywords") and q2.get("expected_key_points")),
        q2.get("question_text", "") if q2 else "missing",
    )


def test_keyword_and_llm_adapters() -> None:
    transcript = "REST APIs are stateless and use HTTP GET POST PUT DELETE endpoints with JSON resources."
    keywords = ["stateless", "HTTP", "GET", "POST", "JSON", "uniform interface"]
    keyword_result = extract_keywords(transcript, keywords)
    record(
        "keyword extraction coverage",
        keyword_result["keyword_score"] >= 7,
        json.dumps(
            {
                "score": keyword_result["keyword_score"],
                "found": keyword_result["found_keywords"],
                "missing": keyword_result["missing_keywords"],
            }
        ),
    )

    llm_result = evaluate_answer(
        "What is a REST API and what are its core principles?",
        transcript,
        ["REST stands for Representational State Transfer", "Uses standard HTTP methods"],
    )
    record(
        "llm_service fallback contract",
        all(key in llm_result for key in ["relevance_score", "correctness_score", "summary_feedback", "llm_engine"]),
        json.dumps({"engine": llm_result.get("llm_engine"), "relevance": llm_result.get("relevance_score")}),
    )


def test_audio_and_stt_wrappers() -> str:
    wav_path = make_synthetic_wav()
    transcript = "REST APIs are stateless and use HTTP methods like GET and POST with JSON responses."
    metrics = analyze_delivery(wav_path, transcript, duration_seconds=8.0)
    record(
        "audio delivery analysis",
        metrics["deliveryScore"] > 0 and metrics["speechRateWpm"] > 0,
        json.dumps(
            {
                "wpm": metrics["speechRateWpm"],
                "pauses": metrics["pauseCount"],
                "delivery": metrics["deliveryScore"],
                "audio": metrics.get("audio_analysis_available", True),
            }
        ),
    )

    small = Path(tempfile.gettempdir()) / "tiny_audio.wav"
    small.write_bytes(b"tiny")
    stt_result = transcribe(str(small))
    record(
        "stt_service small-file guard",
        stt_result["engine"] == "none" and stt_result["transcript"] == "",
        json.dumps(stt_result),
    )
    small.unlink(missing_ok=True)
    return wav_path


async def test_pipeline_cases() -> None:
    cases = [
        (
            "q2 strong REST answer",
            "q2",
            "REST stands for Representational State Transfer. It uses HTTP methods like GET, POST, PUT, and DELETE. It is stateless, uses URI resources, and often returns JSON.",
            6.0,
        ),
        (
            "q2 weak REST answer",
            "q2",
            "Um it is like an API thing used by websites. You send something and get something back. I am not sure about the principles.",
            0.0,
        ),
        (
            "q1 partial OSI answer",
            "q1",
            "The OSI model has seven layers. The network layer handles routing and IP addressing, while the transport layer uses TCP or UDP for delivery.",
            4.0,
        ),
        (
            "q3 short process/thread answer",
            "q3",
            "A process has separate memory. Threads are lighter and share memory inside a process.",
            3.0,
        ),
    ]

    scores: dict[str, float] = {}
    for name, question_id, transcript, minimum in cases:
        result = await analyze_answer_pipeline(
            question_id=question_id,
            user_id="stretch-user",
            transcript=transcript,
            duration_seconds=45,
        )
        score = float(result["overallScore"])
        scores[name] = score
        record(
            f"pipeline {name}",
            score >= minimum and result["weights"] == {"content": 0.7, "delivery": 0.3},
            json.dumps(
                {
                    "score": score,
                    "label": result["label"],
                    "content": result["contentScores"]["contentScore"],
                    "delivery": result["deliveryScores"]["deliveryScore"],
                    "found": result["keywords"]["keywordsFound"][:4],
                }
            ),
        )

    record(
        "strong answer scores above weak answer",
        scores["q2 strong REST answer"] > scores["q2 weak REST answer"],
        json.dumps({"strong": scores["q2 strong REST answer"], "weak": scores["q2 weak REST answer"]}),
    )


def test_fastapi_contract(wav_path: str) -> None:
    client = TestClient(app)

    questions_response = client.get("/api/questions")
    record(
        "GET /api/questions",
        questions_response.status_code == 200 and len(questions_response.json().get("questions", [])) == 5,
        f"status={questions_response.status_code}",
    )

    response = client.post(
        "/api/analyze-answer",
        data={
            "user_id": "stretch-user",
            "question_id": "q2",
            "duration_seconds": "35",
            "transcript": "REST stands for Representational State Transfer. It uses HTTP GET POST PUT and DELETE, stays stateless, and returns JSON resources.",
        },
    )
    body = response.json()
    record(
        "POST /api/analyze-answer text-only",
        response.status_code == 200 and body.get("success") is True and body.get("weights") == {"content": 0.7, "delivery": 0.3},
        json.dumps({"status": response.status_code, "score": body.get("overallScore"), "label": body.get("label")}),
    )

    with open(wav_path, "rb") as audio_file:
        audio_response = client.post(
            "/api/analyze-answer",
            data={
                "user_id": "stretch-user",
                "question_id": "q2",
                "duration_seconds": "8",
                "transcript": "REST APIs are stateless and use HTTP GET and POST with JSON responses.",
            },
            files={"audio": ("synthetic.wav", audio_file, "audio/wav")},
        )
    audio_body = audio_response.json()
    saved_path = audio_body.get("audioPath")
    if saved_path:
        Path(saved_path).unlink(missing_ok=True)
    record(
        "POST /api/analyze-answer audio plus transcript",
        audio_response.status_code == 200 and audio_body.get("audioMetrics", {}).get("speechRateWpm", 0) > 0,
        json.dumps({"status": audio_response.status_code, "score": audio_body.get("overallScore")}),
    )

    bad_response = client.post("/api/analyze-answer", data={"question_id": "q2"})
    record(
        "POST /api/analyze-answer rejects empty request",
        bad_response.status_code == 400,
        f"status={bad_response.status_code}",
    )


async def main() -> int:
    check_dependencies()
    test_question_bank()
    test_keyword_and_llm_adapters()
    wav_path = test_audio_and_stt_wrappers()
    await test_pipeline_cases()
    test_fastapi_contract(wav_path)
    Path(wav_path).unlink(missing_ok=True)

    passed = sum(1 for status, _, _ in RESULTS if status == "PASS")
    failed = sum(1 for status, _, _ in RESULTS if status == "FAIL")
    warned = sum(1 for status, _, _ in RESULTS if status == "WARN")

    print("\nStretch test summary")
    print(json.dumps({"passed": passed, "failed": failed, "warnings": warned}, indent=2))

    if failed:
        print("\nFailures:")
        for status, name, detail in RESULTS:
            if status == "FAIL":
                print(f"- {name}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
