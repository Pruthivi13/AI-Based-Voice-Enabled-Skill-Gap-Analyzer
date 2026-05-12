"""
Final score engine.

Content carries 70 percent and delivery carries 30 percent, as requested.
"""
from __future__ import annotations

from typing import Any


def _round(value: float) -> float:
    return round(float(value), 2)


def _label(score: float) -> str:
    if score < 5.0:
        return "WEAK"
    if score < 7.5:
        return "AVERAGE"
    return "STRONG"


def _feedback_for_delivery(audio_metrics: dict[str, Any]) -> list[str]:
    feedback: list[str] = []
    scores = audio_metrics.get("scores", {})
    has_audio = audio_metrics.get("audio_available", True)

    if has_audio and scores.get("pace", 10) < 7:
        pace_label = audio_metrics.get("pace_label", "uneven")
        feedback.append(f"Your speaking pace was {pace_label}; aim for a steady interview pace.")
    if has_audio and audio_metrics.get("long_pause_count", 0) > 0:
        feedback.append(
            f"Reduce long pauses; {audio_metrics['long_pause_count']} long pause(s) were detected."
        )
    if audio_metrics.get("filler_count", 0) > 0:
        feedback.append(
            f"Reduce filler words; {audio_metrics['filler_count']} filler word(s) were detected."
        )
    hesitation = audio_metrics.get("hesitation", {})
    if (
        audio_metrics.get("repeated_start_count", 0) > 0
        or hesitation.get("self_correction_count", 0) > 0
        or hesitation.get("pause_before_short_segment_count", 0) > 0
    ):
        feedback.append("Practice cleaner sentence starts to reduce repeated-word fumbles.")
    if scores.get("hesitation_control", 10) < 7:
        feedback.append("Work on reducing hesitation markers and restart patterns during key explanations.")
    if has_audio and scores.get("confidence_cues", 10) < 7:
        feedback.append("Aim for steadier vocal energy and more even phrase delivery to sound more confident.")
    if has_audio and scores.get("voice_quality", 10) < 7:
        feedback.append("Work on steadier voice quality by keeping volume and pitch more controlled.")

    return feedback


def _content_model_score(content_model_result: dict[str, Any] | None) -> float | None:
    if not content_model_result:
        return None
    try:
        return _round(content_model_result.get("content_score"))
    except (TypeError, ValueError):
        label = str(content_model_result.get("final_score") or "").upper()
        if label == "STRONG":
            return 8.5
        if label == "AVERAGE":
            return 6.5
        if label == "WEAK":
            return 4.0
    return None


def build_final_result(
    question: dict[str, Any],
    transcript: str,
    keyword_result: dict[str, Any],
    llm_result: dict[str, Any],
    audio_metrics: dict[str, Any],
    content_model_result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    content_scores = {
        "relevance": _round(llm_result.get("relevance_score", 0.0)),
        "correctness": _round(llm_result.get("correctness_score", 0.0)),
        "completeness": _round(llm_result.get("completeness_score", 0.0)),
        "clarity": _round(llm_result.get("clarity_score", 0.0)),
    }
    rubric_content_score = _round(sum(content_scores.values()) / len(content_scores))
    model_signal_score = _content_model_score(content_model_result)
    content_score = (
        _round((rubric_content_score * 0.85) + (model_signal_score * 0.15))
        if model_signal_score is not None
        else rubric_content_score
    )
    delivery_scores = audio_metrics.get("scores", {})
    delivery_score = _round(delivery_scores.get("delivery", 0.0))
    overall_score = _round((content_score * 0.7) + (delivery_score * 0.3))
    final_label = _label(overall_score)

    strengths = list(llm_result.get("strengths", []))
    improvements = list(llm_result.get("improvements", []))
    improvements.extend(_feedback_for_delivery(audio_metrics))
    if content_model_result:
        model_feedback = content_model_result.get("feedback")
        if content_model_result.get("final_score") == "STRONG":
            strengths.append("The content scorer found strong alignment with the reference answer.")
        elif content_model_result.get("final_score") != "UNSCORED" and model_feedback:
            improvements.append(str(model_feedback))

    if not strengths:
        strengths.append("The response has enough signal to evaluate.")
    if not improvements:
        improvements.append("Add more depth and examples to make the answer stand out.")

    feedback = llm_result.get("final_summary") or "Evaluation complete."
    if final_label == "STRONG":
        feedback = f"{feedback} Overall, this is a strong answer."
    elif final_label == "AVERAGE":
        feedback = f"{feedback} Overall, this is average and can improve with more detail."
    else:
        feedback = f"{feedback} Overall, this needs more complete coverage."

    return {
        "question_id": question.get("id"),
        "question_text": question.get("question_text") or question.get("content"),
        "transcript": transcript,
        "keywords_found": llm_result.get("keywords_found")
        or keyword_result.get("keywords_found", []),
        "missing_keywords": llm_result.get("missing_keywords")
        or keyword_result.get("missing_keywords", []),
        "keyword_analysis": keyword_result,
        "content_scores": content_scores,
        "rubric_content_score": rubric_content_score,
        "content_model_score": model_signal_score,
        "delivery_scores": {
            "pace": _round(delivery_scores.get("pace", 0.0)),
            "pause_control": _round(delivery_scores.get("pause_control", 0.0)),
            "filler_control": _round(delivery_scores.get("filler_control", 0.0)),
            "hesitation_control": _round(delivery_scores.get("hesitation_control", 0.0)),
            "cadence_control": _round(delivery_scores.get("cadence_control", 0.0)),
            "articulation": _round(delivery_scores.get("articulation", 0.0)),
            "voice_quality": _round(delivery_scores.get("voice_quality", 0.0)),
            "fluency": _round(delivery_scores.get("fluency", 0.0)),
            "confidence_cues": _round(delivery_scores.get("confidence_cues", 0.0)),
            "delivery": delivery_score,
        },
        "audio_metrics": {
            key: value
            for key, value in audio_metrics.items()
            if key != "scores"
        },
        "content_score": content_score,
        "delivery_score": delivery_score,
        "overall_score": overall_score,
        "label": final_label,
        "strengths": strengths[:6],
        "improvements": improvements[:6],
        "feedback": feedback,
        "llm_provider": llm_result.get("provider"),
        "scorer_backend": (
            content_model_result.get("scorer_backend")
            if content_model_result
            else None
        ),
        "llm_evaluation": llm_result,
        "content_model_evaluation": content_model_result,
    }
