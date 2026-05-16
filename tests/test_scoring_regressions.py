import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

if os.getenv("RUN_LIVE_LLM_STABILITY") != "1":
    os.environ["LLM_PROVIDER_ORDER"] = ""

from backend.services.audio_analysis import analyze_audio
from backend.services.keyword_extractor import extract_keywords
from backend.services.scoring import build_final_result


def test_transcript_only_audio_scores_are_unavailable():
    result = analyze_audio(None, "um REST APIs are stateless HTTP interfaces")

    assert result["audio_available"] is False
    assert result["words_per_minute"] == 0.0
    assert result["words_per_minute_basis"] == "not_available"
    assert all(score == 0.0 for score in result["scores"].values())
    assert result["filler_count"] == 1


def test_final_score_excludes_delivery_when_audio_is_unavailable():
    result = build_final_result(
        question={"id": "q1", "question_text": "Explain REST APIs."},
        transcript="REST APIs expose stateless HTTP resources.",
        keyword_result={"keywords_found": [], "missing_keywords": []},
        llm_result={
            "relevance_score": 8.0,
            "correctness_score": None,
            "completeness_score": 6.0,
            "clarity_score": 4.0,
            "strengths": [],
            "improvements": [],
            "final_summary": "Done.",
            "provider": "test",
        },
        audio_metrics={
            "audio_available": False,
            "scores": {
                "delivery": 10.0,
                "fluency": 10.0,
                "confidence_cues": 10.0,
            },
        },
    )

    assert result["rubric_content_score"] == 6.31
    assert result["content_scores"]["correctness"] == 0.0
    assert result["delivery_score"] == 0.0
    assert result["delivery_scores"]["delivery"] == 0.0
    assert result["delivery_scores"]["fluency"] == 0.0
    assert result["overall_score"] == result["content_score"]


def test_negated_keyword_is_not_counted_as_found():
    result = extract_keywords(
        "The network layer does not handle routing.",
        expected_keywords=["network layer handles routing"],
        expected_key_points=[],
    )

    assert result["keywords_found"] == []
    assert result["missing_keywords"] == ["network layer handles routing"]


def test_non_negated_phrase_with_later_contrast_still_matches():
    result = extract_keywords(
        "The network layer handles routing, not encryption.",
        expected_keywords=["network layer handles routing"],
        expected_key_points=[],
    )

    assert result["keywords_found"] == ["network layer handles routing"]
