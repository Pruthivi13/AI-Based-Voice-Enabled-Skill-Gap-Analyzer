"""Final scoring utilities for the interview evaluator."""

from __future__ import annotations

from typing import Any


def _num(value: Any, default: float = 5.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp_score(value: Any, default: float = 5.0) -> float:
    return round(min(10.0, max(0.0, _num(value, default))), 1)


def content_score(llm_result: dict, keyword_result: dict | None = None) -> float:
    keyword_result = keyword_result or {}
    llm_overall = llm_result.get("overallContentScore")
    if llm_overall is not None:
        base = _num(llm_overall)
    else:
        base = (
            _num(llm_result.get("relevance"))
            + _num(llm_result.get("correctness"))
            + _num(llm_result.get("completeness"))
            + _num(llm_result.get("clarity"))
        ) / 4

    keyword_coverage = _num(keyword_result.get("keywordCoveragePercent"), 0.0) / 10
    if keyword_coverage > 0:
        base = base * 0.85 + keyword_coverage * 0.15
    return clamp_score(base)


def label_for_score(score: float) -> str:
    if score < 5.0:
        return "WEAK"
    if score < 7.5:
        return "AVERAGE"
    return "STRONG"


def combine_scores(
    llm_result: dict,
    delivery_metrics: dict,
    keyword_result: dict | None = None,
) -> dict:
    content = content_score(llm_result, keyword_result)
    delivery = clamp_score(delivery_metrics.get("deliveryScore"), 5.0)
    overall = round(content * 0.7 + delivery * 0.3, 1)

    return {
        "contentScore": content,
        "deliveryScore": delivery,
        "overallScore": overall,
        "label": label_for_score(overall),
        "weights": {"content": 0.7, "delivery": 0.3},
    }


def build_feedback(
    llm_result: dict,
    delivery_metrics: dict,
    keyword_result: dict,
    scoring_result: dict,
) -> dict:
    strengths = list(llm_result.get("strengths") or [])
    improvements = list(llm_result.get("improvements") or [])

    if keyword_result.get("keywordsFound"):
        strengths.append("Covered important concepts from the expected answer.")
    if keyword_result.get("missingKeywords"):
        missing = ", ".join(keyword_result["missingKeywords"][:3])
        improvements.append(f"Add missing concepts: {missing}.")
    if delivery_metrics.get("fillerWordCount", 0) > 3:
        improvements.append("Reduce filler words to sound more fluent.")
    if delivery_metrics.get("longPauseCount", 0) > 0:
        improvements.append("Practice smoother transitions to reduce long pauses.")

    summary = llm_result.get("feedback") or "Answer evaluated successfully."
    delivery_note = delivery_metrics.get("deliveryFeedback")
    if delivery_note:
        summary = f"{summary} {delivery_note}"

    return {
        "summaryFeedback": summary.strip(),
        "strengths": list(dict.fromkeys(strengths))[:5],
        "improvements": list(dict.fromkeys(improvements))[:5],
        "finalFeedback": {
            "content": scoring_result["contentScore"],
            "delivery": scoring_result["deliveryScore"],
            "overall": scoring_result["overallScore"],
            "label": scoring_result["label"],
        },
    }
