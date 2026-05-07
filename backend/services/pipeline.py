"""End-to-end AI interview evaluation pipeline."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from backend.services.audio_analysis import analyze_delivery
from backend.services.gemini_evaluator import evaluate_with_gemini
from backend.services.keyword_extractor import extract_keywords
from backend.services.question_bank import normalize_question_payload
from backend.services.scoring import build_feedback, combine_scores
from backend.services.semantic_scorer import compute_keypoint_coverage
from backend.services.transcription import transcribe_audio_file


async def analyze_answer_pipeline(
    *,
    audio_path: str | Path | None = None,
    transcript: str | None = None,
    question_id: str | int | None = None,
    user_id: str | None = None,
    question_text: str | None = None,
    expected_keywords: list[str] | None = None,
    expected_key_points: list[str] | None = None,
    reference_answer: str | None = None,
    duration_seconds: float | None = None,
) -> dict[str, Any]:
    """
    Complete pipeline:
    audio -> STT -> keywords -> semantic coverage -> LLM -> delivery -> score.
    """
    loop = asyncio.get_running_loop()
    question = normalize_question_payload(
        question_id=question_id,
        question_text=question_text,
        expected_keywords=expected_keywords,
        expected_key_points=expected_key_points,
        reference_answer=reference_answer,
    )

    if not transcript:
        if not audio_path:
            raise ValueError("Either audio_path or transcript must be provided")
        transcript = await loop.run_in_executor(
            None, lambda: transcribe_audio_file(audio_path)
        )

    transcript = transcript or ""

    keyword_result = await loop.run_in_executor(
        None,
        lambda: extract_keywords(
            transcript,
            expected_keywords=question["expectedKeywords"],
            expected_key_points=question["expectedKeyPoints"],
        ),
    )

    semantic_coverage = await loop.run_in_executor(
        None,
        lambda: compute_keypoint_coverage(
            transcript,
            question["expectedKeyPoints"],
        ),
    )

    delivery_metrics = await loop.run_in_executor(
        None,
        lambda: analyze_delivery(
            audio_path,
            transcript,
            duration_seconds=duration_seconds,
        ),
    )

    llm_result = await loop.run_in_executor(
        None,
        lambda: evaluate_with_gemini(
            question=question["questionText"],
            transcript=transcript,
            expected_key_points=question["expectedKeyPoints"],
            reference_answer=question["referenceAnswer"],
            semantic_coverage=semantic_coverage,
            delivery_metrics=delivery_metrics,
        ),
    )

    scoring_result = combine_scores(llm_result, delivery_metrics, keyword_result)
    feedback = build_feedback(
        llm_result,
        delivery_metrics,
        keyword_result,
        scoring_result,
    )

    return {
        "success": True,
        "userId": user_id,
        "questionId": question["id"],
        "question": question["questionText"],
        "transcript": transcript,
        "keywords": keyword_result,
        "semanticCoverage": semantic_coverage,
        "contentScores": {
            "relevance": llm_result.get("relevance", 5.0),
            "correctness": llm_result.get("correctness", 5.0),
            "completeness": llm_result.get("completeness", 5.0),
            "clarity": llm_result.get("clarity", 5.0),
            "contentScore": scoring_result["contentScore"],
        },
        "deliveryScores": {
            "pace": delivery_metrics.get("paceScore", 5.0),
            "pauseControl": delivery_metrics.get("pauseScore", 5.0),
            "fluency": delivery_metrics.get("fluencyScore", 5.0),
            "deliveryScore": scoring_result["deliveryScore"],
        },
        "audioMetrics": delivery_metrics,
        "llmEvaluation": llm_result,
        "overallScore": scoring_result["overallScore"],
        "label": scoring_result["label"],
        "weights": scoring_result["weights"],
        **feedback,
    }
