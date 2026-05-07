"""
Gemini-first content evaluator with Groq fallback.

Default first attempt follows the requested MVP stack: Gemini 1.5 Flash.
If that model is unavailable, the service tries newer Gemini Flash models before
falling back to Groq/local evaluation.
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


def _normalize_result(result: dict) -> dict:
    def clamp(value, default=5.0):
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = default
        return round(min(10.0, max(0.0, number)), 1)

    return {
        "correctness": clamp(result.get("correctness")),
        "completeness": clamp(result.get("completeness")),
        "clarity": clamp(result.get("clarity")),
        "relevance": clamp(result.get("relevance")),
        "overallContentScore": clamp(result.get("overallContentScore")),
        "keywordsFound": list(result.get("keywordsFound") or []),
        "missingPoints": list(result.get("missingPoints") or []),
        "strengths": list(result.get("strengths") or []),
        "improvements": list(result.get("improvements") or []),
        "feedback": str(result.get("feedback") or "Evaluation complete."),
        "engine": result.get("engine", "gemini"),
    }


def _gemini_model_candidates() -> list[str]:
    primary = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    fallback_env = os.getenv(
        "GEMINI_FALLBACK_MODELS",
        "gemini-2.5-flash,gemini-2.0-flash-lite,gemini-flash-latest",
    )
    models = [primary] + [item.strip() for item in fallback_env.split(",") if item.strip()]
    return list(dict.fromkeys(models))


def evaluate_with_gemini(
    question: str,
    transcript: str,
    expected_key_points: list[str],
    reference_answer: str,
    semantic_coverage: dict | None = None,
    delivery_metrics: dict | None = None,
) -> dict:
    if not transcript or len(transcript.strip()) < 5:
        from backend.services.llm_evaluator import evaluate_with_llm

        return evaluate_with_llm(question, transcript, expected_key_points, reference_answer)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.info("GEMINI_API_KEY not set; using Groq/local fallback")
        from backend.services.llm_evaluator import evaluate_with_llm

        return evaluate_with_llm(question, transcript, expected_key_points, reference_answer)

    semantic_coverage = semantic_coverage or {}
    delivery_metrics = delivery_metrics or {}

    coverage_lines = "\n".join(
        f"- {point}: {'covered' if point in semantic_coverage.get('coveredPoints', []) else 'not clearly covered'}"
        for point in expected_key_points
    )

    prompt = f"""You are an interview panel evaluator. Judge content only; delivery metrics are extra context.

Question:
{question}

Expected key points:
{coverage_lines}

Semantic coverage estimate:
{semantic_coverage.get("coveragePercent", 0)}%

Reference answer:
{reference_answer or "Not provided"}

Candidate transcript:
{transcript[:3000]}

Delivery context:
- Words per minute: {delivery_metrics.get("speechRateWpm", "N/A")}
- Pause count: {delivery_metrics.get("pauseCount", "N/A")}
- Long pauses: {delivery_metrics.get("longPauseCount", delivery_metrics.get("longPauses", "N/A"))}
- Filler words: {delivery_metrics.get("fillerWordCount", "N/A")}

Return only valid JSON:
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

    last_error = None

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        for model_name in _gemini_model_candidates():
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                result = _extract_json(response.text or "")
                result["engine"] = f"gemini:{model_name}"
                logger.info("Gemini evaluation complete via %s", model_name)
                return _normalize_result(result)
            except Exception as exc:
                last_error = exc
                logger.warning("Gemini model %s failed: %s", model_name, exc)
    except Exception as new_sdk_error:
        last_error = new_sdk_error
        logger.warning("google-genai SDK unavailable or failed: %s", new_sdk_error)

    try:
        import google.generativeai as legacy_genai

        legacy_genai.configure(api_key=api_key)
        for model_name in _gemini_model_candidates():
            try:
                model = legacy_genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                result = _extract_json(response.text or "")
                result["engine"] = f"gemini:{model_name}"
                logger.info("Gemini evaluation complete via legacy SDK %s", model_name)
                return _normalize_result(result)
            except Exception as exc:
                last_error = exc
                logger.warning("Legacy Gemini model %s failed: %s", model_name, exc)
    except Exception as legacy_error:
        last_error = legacy_error

    logger.error("Gemini evaluation failed; using Groq/local fallback: %s", last_error)
    from backend.services.llm_evaluator import evaluate_with_llm

    return evaluate_with_llm(question, transcript, expected_key_points, reference_answer)
