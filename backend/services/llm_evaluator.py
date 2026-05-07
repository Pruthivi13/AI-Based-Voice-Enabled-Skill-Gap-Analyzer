"""
Groq LLM evaluator.

This is the fallback content evaluator when Gemini is unavailable. If no Groq
key is configured, it returns a deterministic rubric-based local estimate so
the rest of the app remains demoable.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv

from utils.logger import setup_logger

load_dotenv()
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

logger = setup_logger(__name__)


def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        raw = match.group(0)
    return json.loads(raw)


def _clamp(value, default: float = 5.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    return round(min(10.0, max(0.0, number)), 1)


_LOCAL_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "each",
    "from",
    "that",
    "this",
    "are",
    "is",
    "its",
    "all",
    "like",
    "typically",
}


def _concept_tokens(text: str) -> set[str]:
    tokens = set()
    for token in re.findall(r"\b[\w']+\b", (text or "").lower()):
        if len(token) <= 2 or token in _LOCAL_STOPWORDS:
            continue
        token = token.strip("'")
        if token.endswith("ies") and len(token) > 4:
            token = token[:-3] + "y"
        elif token.endswith("s") and len(token) > 4:
            token = token[:-1]
        tokens.add(token)
    return tokens


def _local_rubric_estimate(
    question: str,
    transcript: str,
    expected_key_points: list[str],
    reference_answer: str = "",
) -> dict:
    words = re.findall(r"\b[\w']+\b", transcript.lower())
    word_count = len(words)
    transcript_text = " ".join(words)
    transcript_tokens = _concept_tokens(transcript)

    covered = []
    missing = []
    for point in expected_key_points:
        point_words = _concept_tokens(point)
        if not point_words:
            continue
        overlap = len(point_words & transcript_tokens) / len(point_words)
        if overlap >= 0.30 or point.lower() in transcript.lower():
            covered.append(point)
        else:
            missing.append(point)

    coverage_ratio = len(covered) / len(expected_key_points) if expected_key_points else 0.5
    length_score = 4.0 if word_count < 20 else 6.0 if word_count < 50 else 8.0
    completeness = _clamp(coverage_ratio * 10)
    relevance = _clamp(max(completeness, 5.0 if word_count else 2.0))
    correctness = _clamp(completeness * 0.8 + length_score * 0.2)
    clarity = _clamp(length_score)
    overall = _clamp((relevance + correctness + completeness + clarity) / 4)

    keywords = sorted(
        {
            word
            for word in words
            if len(word) > 4 and word not in {"because", "actually", "basically"}
        }
    )[:8]

    if not transcript.strip():
        feedback = "No transcript was available for content evaluation."
    elif missing:
        feedback = "The answer is partly relevant, but it misses some expected concepts."
    else:
        feedback = "The answer covers the expected concepts and stays relevant."

    return {
        "correctness": correctness,
        "completeness": completeness,
        "clarity": clarity,
        "relevance": relevance,
        "overallContentScore": overall,
        "keywordsFound": keywords,
        "missingPoints": missing,
        "strengths": ["Stays on the asked topic"] if transcript_text else [],
        "improvements": [f"Cover this point: {missing[0]}"] if missing else [],
        "feedback": feedback,
        "engine": "local-rubric",
    }


def evaluate_with_llm(
    question: str,
    transcript: str,
    expected_key_points: list[str],
    reference_answer: str = "",
) -> dict:
    """
    Evaluate transcript against expected key points using Groq.
    Returns scores on a 0-10 scale and JSON-friendly feedback.
    """
    if not transcript or len(transcript.strip()) < 5:
        return _local_rubric_estimate(question, transcript, expected_key_points, reference_answer)

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set; using local rubric estimate")
        return _local_rubric_estimate(question, transcript, expected_key_points, reference_answer)

    key_points_str = "\n".join(f"- {point}" for point in expected_key_points)
    prompt = f"""You are a strict but fair interview answer evaluator.

Question:
{question}

Expected key points:
{key_points_str}

Reference answer:
{reference_answer or "Not provided"}

Candidate transcript:
{transcript[:3000]}

Score each field from 0 to 10:
- relevance
- correctness
- completeness
- clarity

Return only valid JSON with this schema:
{{
  "correctness": 7.5,
  "completeness": 6.0,
  "clarity": 8.0,
  "relevance": 7.0,
  "overallContentScore": 7.1,
  "keywordsFound": ["keyword"],
  "missingPoints": ["missing point"],
  "strengths": ["specific strength"],
  "improvements": ["specific improvement"],
  "feedback": "Brief constructive feedback."
}}"""

    try:
        from groq import Groq

        client = Groq(api_key=api_key)
        models = [
            os.getenv("GROQ_LLM_MODEL", "llama-3.3-70b-versatile"),
            "llama-3.1-8b-instant",
            "gemma2-9b-it",
        ]

        last_error = None
        for model_name in dict.fromkeys(models):
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": "Return only strict JSON. Do not include markdown.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_tokens=900,
                )
                result = _extract_json(response.choices[0].message.content or "")
                result["engine"] = f"groq:{model_name}"
                return _normalize_result(result)
            except Exception as exc:
                last_error = exc
                logger.warning("Groq model %s failed: %s", model_name, exc)

        logger.error("All Groq LLM models failed: %s", last_error)
    except Exception as exc:
        logger.error("Groq evaluator unavailable: %s", exc)

    return _local_rubric_estimate(question, transcript, expected_key_points, reference_answer)


def _normalize_result(result: dict) -> dict:
    return {
        "correctness": _clamp(result.get("correctness")),
        "completeness": _clamp(result.get("completeness")),
        "clarity": _clamp(result.get("clarity")),
        "relevance": _clamp(result.get("relevance")),
        "overallContentScore": _clamp(result.get("overallContentScore")),
        "keywordsFound": list(result.get("keywordsFound") or []),
        "missingPoints": list(result.get("missingPoints") or []),
        "strengths": list(result.get("strengths") or []),
        "improvements": list(result.get("improvements") or []),
        "feedback": str(result.get("feedback") or "Evaluation complete."),
        "engine": result.get("engine", "groq"),
    }
