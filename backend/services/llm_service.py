"""
LLM content evaluator.

Primary: Gemini Flash via Google AI Studio.
Fallback: Groq chat completion.
Last resort: deterministic rubric heuristic so demos still run without keys.
"""
from __future__ import annotations

import json
import copy
import hashlib
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from utils.logger import setup_logger

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

logger = setup_logger(__name__)

_eval_cache: dict[str, dict[str, Any]] = {}


def _provider_timeout_seconds(default: float = 10.0) -> float:
    raw = os.getenv("LLM_PROVIDER_TIMEOUT_SECONDS")
    if raw is None:
        return default
    try:
        return max(1.0, float(raw))
    except ValueError:
        return default


def _cache_key(
    question_text: str,
    transcript: str,
    expected_keywords: list[str],
    expected_key_points: list[str],
    ideal_answer: str,
) -> str:
    payload = json.dumps(
        {
            "q": question_text.strip().lower(),
            "t": transcript.strip().lower(),
            "k": sorted(str(item).strip().lower() for item in expected_keywords),
            "p": sorted(str(item).strip().lower() for item in expected_key_points),
            "i": ideal_answer.strip().lower(),
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _call_provider_with_timeout(
    provider: str,
    func,
) -> dict[str, Any]:
    timeout_seconds = _provider_timeout_seconds()
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=f"llm-{provider}")
    future = executor.submit(func)
    try:
        return future.result(timeout=timeout_seconds)
    except FuturesTimeoutError as error:
        future.cancel()
        raise TimeoutError(
            f"{provider} content evaluation timed out after {timeout_seconds:.1f}s"
        ) from error
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def _provider_max_retries(provider: str, default: int = 0) -> int:
    specific = os.getenv(f"{provider.upper()}_MAX_RETRIES")
    generic = os.getenv("LLM_MAX_RETRIES")
    raw = specific if specific is not None else generic
    if raw is None:
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        return default


def _is_daily_quota_error(error_text: str) -> bool:
    lowered = error_text.lower()
    return (
        "quota exceeded" in lowered
        or "free_tier_requests" in lowered
        or "requestsperday" in lowered
        or "generate_content_free_tier_requests" in lowered
    )


def _rate_limit_delay(error_text: str, fallback_seconds: float) -> float:
    retry_match = re.search(r"retry in ([\d.]+)", error_text, re.IGNORECASE)
    if retry_match:
        return float(retry_match.group(1))

    retry_delay_match = re.search(r"seconds:\s*(\d+)", error_text, re.IGNORECASE)
    if retry_delay_match:
        return float(retry_delay_match.group(1))

    return fallback_seconds


def _score(value: Any, default: float = 0.0) -> float:
    try:
        return max(0.0, min(10.0, float(value)))
    except (TypeError, ValueError):
        return default


def _list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in re.split(r",|\n|;", value) if item.strip()]
    return []


def _extract_json_object(raw: str) -> dict[str, Any]:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _build_prompt(
    question_text: str,
    transcript: str,
    expected_keywords: list[str],
    expected_key_points: list[str],
    ideal_answer: str,
) -> str:
    return f"""
You are an interview answer evaluator. Judge only the candidate answer below.
Use the expected key points as ground truth and do not invent missing facts.

Question:
{question_text}

Expected keywords:
{json.dumps(expected_keywords, ensure_ascii=True)}

Expected key points:
{json.dumps(expected_key_points, ensure_ascii=True)}

Ideal answer, if available:
{ideal_answer or "Not provided"}

Candidate transcript:
{transcript}

Return JSON only with exactly these fields:
{{
  "keywords_found": ["terms from expected keywords or transcript"],
  "missing_keywords": ["important expected keywords not covered"],
  "relevance_score": 0-10,
  "correctness_score": 0-10,
  "completeness_score": 0-10,
  "clarity_score": 0-10,
  "strengths": ["short strength"],
  "improvements": ["short improvement"],
  "final_summary": "brief constructive feedback"
}}
""".strip()


def _normalize_llm_result(
    data: dict[str, Any],
    provider: str,
    raw_response: str | None = None,
) -> dict[str, Any]:
    normalized = {
        "keywords_found": _list(data.get("keywords_found")),
        "missing_keywords": _list(data.get("missing_keywords")),
        "relevance_score": _score(data.get("relevance_score")),
        "correctness_score": _score(data.get("correctness_score")),
        "completeness_score": _score(data.get("completeness_score")),
        "clarity_score": _score(data.get("clarity_score")),
        "strengths": _list(data.get("strengths")),
        "improvements": _list(data.get("improvements")),
        "final_summary": str(data.get("final_summary") or "").strip(),
        "provider": provider,
    }
    if raw_response is not None:
        normalized["raw_response"] = raw_response

    if not normalized["strengths"]:
        normalized["strengths"] = ["The answer contains some relevant material."]
    if not normalized["improvements"]:
        normalized["improvements"] = ["Add more specific expected concepts."]
    if not normalized["final_summary"]:
        normalized["final_summary"] = "The answer was evaluated against the expected key points."

    return normalized


def _evaluate_with_gemini(prompt: str) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured")

    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    model = genai.GenerativeModel(model_name)
    request_options = {"timeout": _provider_timeout_seconds()}

    max_retries = _provider_max_retries("gemini")
    for attempt in range(max_retries + 1):
        try:
            try:
                response = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": 0,
                        "response_mime_type": "application/json",
                    },
                    request_options=request_options,
                )
            except TypeError:
                try:
                    response = model.generate_content(
                        prompt,
                        generation_config={"temperature": 0},
                        request_options=request_options,
                    )
                except TypeError:
                    response = model.generate_content(
                        prompt,
                        generation_config={"temperature": 0},
                    )

            raw = (getattr(response, "text", "") or "").strip()
            return _normalize_llm_result(
                _extract_json_object(raw),
                provider=f"gemini:{model_name}",
                raw_response=raw,
            )
        except Exception as e:
            error_str = str(e)
            if "429" in error_str and _is_daily_quota_error(error_str):
                raise
            if "429" in error_str and attempt < max_retries:
                wait = _rate_limit_delay(error_str, 2 ** attempt * 5)
                logger.info("Gemini rate-limited, retrying in %.1fs (attempt %d/%d)", wait, attempt + 1, max_retries)
                time.sleep(min(wait, 60))
                continue
            raise
    raise RuntimeError("Gemini evaluation failed after all retries")


def _evaluate_with_groq(prompt: str) -> dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    from groq import Groq

    model_name = os.getenv("GROQ_LLM_MODEL", "llama-3.1-8b-instant")
    client = Groq(api_key=api_key, timeout=_provider_timeout_seconds())

    max_retries = _provider_max_retries("groq")
    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a strict interview evaluator. Return valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
                seed=42,
                max_tokens=1400,
                response_format={"type": "json_object"},
            )
            raw = (response.choices[0].message.content or "").strip()
            return _normalize_llm_result(
                _extract_json_object(raw),
                provider=f"groq:{model_name}",
                raw_response=raw,
            )
        except Exception as e:
            error_str = str(e)
            if "429" in error_str and _is_daily_quota_error(error_str):
                raise
            if "429" in error_str and attempt < max_retries:
                wait = _rate_limit_delay(error_str, 2 ** attempt * 3)
                logger.info("Groq rate-limited, retrying in %.1fs (attempt %d/%d)", wait, attempt + 1, max_retries)
                time.sleep(min(wait, 30))
                continue
            raise
    raise RuntimeError("Groq evaluation failed after all retries")


def _phrase_present(phrase: str, transcript: str) -> bool:
    phrase_tokens = re.findall(r"[a-zA-Z0-9+#.-]+", phrase.lower())
    transcript_tokens = set(re.findall(r"[a-zA-Z0-9+#.-]+", transcript.lower()))
    if not phrase_tokens:
        return False
    return all(token in transcript_tokens for token in phrase_tokens)


def _heuristic_evaluation(
    question_text: str,
    transcript: str,
    expected_keywords: list[str],
    expected_key_points: list[str],
    keyword_result: dict[str, Any] | None,
) -> dict[str, Any]:
    words = re.findall(r"[A-Za-z0-9+#.-]+", transcript)
    word_count = len(words)
    found_keywords = (
        keyword_result.get("keywords_found", [])
        if keyword_result
        else [kw for kw in expected_keywords if _phrase_present(kw, transcript)]
    )
    missing_keywords = [
        keyword for keyword in expected_keywords if keyword not in found_keywords
    ]
    found_points = (
        keyword_result.get("key_points_found", [])
        if keyword_result
        else [point for point in expected_key_points if _phrase_present(point, transcript)]
    )

    keyword_coverage = len(found_keywords) / max(len(expected_keywords), 1)
    point_coverage = len(found_points) / max(len(expected_key_points), 1)
    coverage = max(keyword_coverage, point_coverage * 0.9)

    length_bonus = min(word_count / 80, 1.0)
    relevance = _score(3.0 + coverage * 6.0 + length_bonus)
    correctness = _score(2.5 + coverage * 7.0)
    completeness = _score(coverage * 10.0)
    clarity = _score(6.0 + min(word_count / 60, 2.0))
    if word_count < 10:
        clarity = min(clarity, 4.0)

    strengths = []
    improvements = []
    if found_keywords:
        strengths.append("Covered relevant terms: " + ", ".join(found_keywords[:4]))
    if relevance >= 7:
        strengths.append("The response stays close to the question.")
    if missing_keywords:
        improvements.append("Mention missing keywords: " + ", ".join(missing_keywords[:4]))
    if word_count < 35:
        improvements.append("Expand the answer with one or two concrete details.")
    if not improvements:
        improvements.append("Add examples to make the explanation stronger.")

    summary = (
        "The answer was evaluated with a local rubric because no LLM provider was available."
    )
    if coverage >= 0.7:
        summary = "The answer covers most expected concepts and is likely correct."
    elif coverage >= 0.35:
        summary = "The answer is partly relevant but misses important expected concepts."
    elif word_count:
        summary = "The answer has limited concept coverage for this question."

    return _normalize_llm_result(
        {
            "keywords_found": found_keywords,
            "missing_keywords": missing_keywords,
            "relevance_score": relevance,
            "correctness_score": correctness,
            "completeness_score": completeness,
            "clarity_score": clarity,
            "strengths": strengths,
            "improvements": improvements,
            "final_summary": summary,
        },
        provider="heuristic_fallback",
    )


def evaluate_content(
    question_text: str,
    transcript: str,
    expected_keywords: list[str] | None = None,
    expected_key_points: list[str] | None = None,
    ideal_answer: str = "",
    keyword_result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    expected_keywords = expected_keywords or []
    expected_key_points = expected_key_points or []
    key = _cache_key(
        question_text,
        transcript,
        expected_keywords,
        expected_key_points,
        ideal_answer,
    )
    if key in _eval_cache:
        logger.info("LLM eval cache hit")
        return copy.deepcopy(_eval_cache[key])

    prompt = _build_prompt(
        question_text,
        transcript,
        expected_keywords,
        expected_key_points,
        ideal_answer,
    )

    provider_order = [
        item.strip().lower()
        for item in os.getenv("LLM_PROVIDER_ORDER", "gemini,groq").split(",")
        if item.strip()
    ]
    errors: list[str] = []

    for provider in provider_order:
        try:
            if provider == "gemini":
                result = _call_provider_with_timeout(
                    provider,
                    lambda: _evaluate_with_gemini(prompt),
                )
                _eval_cache[key] = copy.deepcopy(result)
                return result
            if provider == "groq":
                result = _call_provider_with_timeout(
                    provider,
                    lambda: _evaluate_with_groq(prompt),
                )
                _eval_cache[key] = copy.deepcopy(result)
                return result
        except Exception as error:
            errors.append(f"{provider}: {error}")
            logger.warning("%s content evaluation failed: %s", provider, error)

    result = _heuristic_evaluation(
        question_text,
        transcript,
        expected_keywords,
        expected_key_points,
        keyword_result,
    )
    result["provider_errors"] = errors
    _eval_cache[key] = copy.deepcopy(result)
    return result
