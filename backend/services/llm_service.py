"""
Compatibility wrapper for LLM answer evaluation.

Claude's suggested architecture imports:
    from backend.services.llm_service import evaluate_answer

The main implementation lives in gemini_evaluator.py and llm_evaluator.py.
This wrapper returns the snake_case field names from Claude's plan.
"""

from __future__ import annotations

from backend.services.gemini_evaluator import evaluate_with_gemini


def evaluate_answer(
    question: str,
    transcript: str,
    key_points: list[str],
    expected_keywords: list[str] | None = None,
) -> dict:
    result = evaluate_with_gemini(
        question=question,
        transcript=transcript,
        expected_key_points=key_points,
        reference_answer="",
        semantic_coverage=None,
        delivery_metrics=None,
    )

    return {
        "relevance_score": result.get("relevance", 5.0),
        "correctness_score": result.get("correctness", 5.0),
        "completeness_score": result.get("completeness", 5.0),
        "clarity_score": result.get("clarity", 5.0),
        "keywords_found": result.get("keywordsFound", []),
        "missing_concepts": result.get("missingPoints", []),
        "strengths": result.get("strengths", []),
        "improvements": result.get("improvements", []),
        "summary_feedback": result.get("feedback", "Answer evaluated successfully."),
        "llm_engine": result.get("engine", "unknown"),
        # Also keep the normalized internal shape for callers that need it.
        "overall_content_score": result.get("overallContentScore", 5.0),
    }
