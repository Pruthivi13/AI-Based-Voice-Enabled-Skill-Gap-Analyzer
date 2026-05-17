"""
Final score engine.

Content carries 70 percent and delivery carries 30 percent for real answers.
For empty, skipped, unrelated, or very low-signal answers, content gates the
final score so fluent nonsense cannot receive an average interview rating.
"""
from __future__ import annotations

import re
from typing import Any

_LOW_SIGNAL_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "it",
    "oh",
    "of",
    "s",
    "so",
    "that",
    "the",
    "this",
    "to",
    "uh",
    "um",
    "yeah",
}


def _round(value: float) -> float:
    return round(float(value), 2)


def _positive_score_or_none(value: Any) -> float | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric <= 0:
        return None
    return _round(numeric)


def _word_tokens(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9+#.-]+", text or "")


def _meaningful_token_count(text: str) -> int:
    return sum(
        1
        for token in _word_tokens(text)
        if token.lower() not in _LOW_SIGNAL_STOPWORDS and len(token) > 2
    )


def _coverage_score(keyword_result: dict[str, Any]) -> float:
    keyword_score = keyword_result.get("keyword_score")
    concept_score = keyword_result.get("concept_score")
    scores = []
    for value in (keyword_score, concept_score):
        try:
            scores.append(float(value))
        except (TypeError, ValueError):
            continue
    if scores:
        return max(scores)

    expected_count = len(keyword_result.get("keywords_found", [])) + len(
        keyword_result.get("missing_keywords", [])
    )
    found_count = len(keyword_result.get("keywords_found", []))
    if expected_count:
        return (found_count / expected_count) * 10.0
    return 0.0


def _model_signal_score(content_model_result: dict[str, Any] | None) -> float | None:
    if not content_model_result:
        return None
    try:
        score = content_model_result.get("content_score")
        if score is not None:
            return float(score)
    except (TypeError, ValueError):
        pass

    label = str(content_model_result.get("final_score") or "").upper()
    if label == "STRONG":
        return 8.5
    if label == "AVERAGE":
        return 6.0
    if label == "WEAK":
        return 2.0
    return None


def _semantic_signal(content_model_result: dict[str, Any] | None) -> float:
    if not content_model_result:
        return 0.0
    try:
        return max(
            float(content_model_result.get("semantic_similarity") or 0.0),
            float(content_model_result.get("keyword_overlap") or 0.0),
            float(content_model_result.get("reference_coverage") or 0.0),
        )
    except (TypeError, ValueError):
        return 0.0


def _is_explicit_non_answer(transcript: str) -> bool:
    normalized = " ".join(token.lower() for token in _word_tokens(transcript))
    if not normalized:
        return True
    patterns = (
        r"\bi do not know\b",
        r"\bi don'?t know\b",
        r"\bno idea\b",
        r"\bnot sure\b",
        r"\bi have no answer\b",
        r"\bskip\b",
        r"\bno speech detected\b",
    )
    return any(re.search(pattern, normalized) for pattern in patterns)


def _low_content_signal(
    transcript: str,
    keyword_result: dict[str, Any],
    rubric_content_score: float,
    content_model_result: dict[str, Any] | None,
) -> tuple[bool, str | None]:
    word_count = len(_word_tokens(transcript))
    meaningful_tokens = _meaningful_token_count(transcript)
    coverage = _coverage_score(keyword_result)
    model_score = _model_signal_score(content_model_result)
    semantic_signal = _semantic_signal(content_model_result)
    has_expected_rubric = bool(
        keyword_result.get("keywords_found")
        or keyword_result.get("missing_keywords")
        or keyword_result.get("key_points_found")
        or keyword_result.get("missing_key_points")
    )

    if _is_explicit_non_answer(transcript):
        return True, "non_answer"

    no_reference_signal = (
        coverage <= 0.0
        and semantic_signal < 0.22
        and (model_score is None or model_score < 4.0)
    )
    if word_count < 8 and no_reference_signal and meaningful_tokens < 3:
        return True, "too_short_without_reference_signal"

    if has_expected_rubric and coverage <= 0.0 and semantic_signal < 0.20:
        if (word_count < 16 and meaningful_tokens < 3) or rubric_content_score < 3.5:
            return True, "unrelated_to_rubric"

    if word_count < 12 and meaningful_tokens < 3 and coverage <= 1.0 and rubric_content_score < 4.0:
        return True, "minimal_content"

    return False, None


def _cap_score(value: float, cap: float) -> float:
    return _round(min(float(value), cap))


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

    if not has_audio:
        feedback.append("Delivery score was not included because no recorded audio was available.")
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
    if has_audio and scores.get("hesitation_control", 10) < 7:
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
        "relevance": _positive_score_or_none(llm_result.get("relevance_score")),
        "correctness": _positive_score_or_none(llm_result.get("correctness_score")),
        "completeness": _positive_score_or_none(llm_result.get("completeness_score")),
        "clarity": _positive_score_or_none(llm_result.get("clarity_score")),
    }

    weights = {
        "relevance": 0.25,
        "correctness": 0.35,
        "completeness": 0.25,
        "clarity": 0.15,
    }
    valid_scores = {key: score for key, score in content_scores.items() if score is not None}

    if valid_scores:
        total_weight = sum(weights[k] for k in valid_scores)
        rubric_content_score = _round(
            sum(valid_scores[k] * (weights[k] / total_weight) for k in valid_scores)
        )
    else:
        rubric_content_score = 0.0

    content_scores_display = {
        key: score if score is not None else 0.0
        for key, score in content_scores.items()
    }

    model_signal_score = _content_model_score(content_model_result)
    content_score = (
        _round((rubric_content_score * 0.85) + (model_signal_score * 0.15))
        if model_signal_score is not None
        else rubric_content_score
    )
    low_signal_answer, low_signal_reason = _low_content_signal(
        transcript=transcript,
        keyword_result=keyword_result,
        rubric_content_score=rubric_content_score,
        content_model_result=content_model_result,
    )
    if low_signal_answer:
        content_score = _cap_score(content_score, 2.5)
        content_scores_display = {
            "relevance": _cap_score(content_scores_display["relevance"], 2.0),
            "correctness": _cap_score(content_scores_display["correctness"], 1.5),
            "completeness": _cap_score(content_scores_display["completeness"], 1.0),
            "clarity": _cap_score(content_scores_display["clarity"], 3.0),
        }

    has_audio = audio_metrics.get("audio_available", True)
    raw_delivery_scores = audio_metrics.get("scores", {})
    delivery_score_keys = (
        "pace",
        "pause_control",
        "filler_control",
        "hesitation_control",
        "cadence_control",
        "articulation",
        "voice_quality",
        "fluency",
        "confidence_cues",
    )
    delivery_scores = (
        {
            key: _round(raw_delivery_scores.get(key, 0.0))
            for key in delivery_score_keys
        }
        if has_audio
        else {key: 0.0 for key in delivery_score_keys}
    )
    delivery_score = _round(raw_delivery_scores.get("delivery", 0.0)) if has_audio else 0.0

    if low_signal_answer:
        delivery_scores = {
            key: _cap_score(score, 3.0)
            for key, score in delivery_scores.items()
        }
        delivery_score = _cap_score(delivery_score, 3.0)
    elif content_score < 4.0:
        delivery_scores = {
            key: _cap_score(score, 5.0)
            for key, score in delivery_scores.items()
        }
        delivery_score = _cap_score(delivery_score, 5.0)

    if has_audio:
        overall_score = _round((content_score * 0.7) + (delivery_score * 0.3))
    else:
        overall_score = content_score

    if low_signal_answer:
        overall_score = _cap_score(overall_score, 2.7)
    elif content_score < 4.0:
        overall_score = _cap_score(overall_score, 4.0)

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

    if low_signal_answer:
        strengths = []
        improvements.insert(
            0,
            "The response did not contain enough relevant technical content to score as an answered question.",
        )

    if not strengths and not low_signal_answer:
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
        "content_scores": content_scores_display,
        "rubric_content_score": rubric_content_score,
        "content_model_score": model_signal_score,
        "delivery_scores": {
            "pace": delivery_scores["pace"],
            "pause_control": delivery_scores["pause_control"],
            "filler_control": delivery_scores["filler_control"],
            "hesitation_control": delivery_scores["hesitation_control"],
            "cadence_control": delivery_scores["cadence_control"],
            "articulation": delivery_scores["articulation"],
            "voice_quality": delivery_scores["voice_quality"],
            "fluency": delivery_scores["fluency"],
            "confidence_cues": delivery_scores["confidence_cues"],
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
        "low_content_signal": low_signal_answer,
        "low_content_reason": low_signal_reason,
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
