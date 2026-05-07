"""Small local question bank for the standalone FastAPI MVP endpoint."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "questions.json"


@lru_cache(maxsize=1)
def load_questions() -> list[dict[str, Any]]:
    if not DATA_PATH.exists():
        return []
    with DATA_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_question(question_id: str | int | None) -> dict[str, Any] | None:
    if question_id is None:
        return None
    target = str(question_id)
    for question in load_questions():
        if str(question.get("id")) == target:
            return question
    return None


def normalize_question_payload(
    question_id: str | int | None = None,
    question_text: str | None = None,
    expected_keywords: list[str] | None = None,
    expected_key_points: list[str] | None = None,
    reference_answer: str | None = None,
) -> dict[str, Any]:
    stored = get_question(question_id) or {}
    key_points = (
        expected_key_points
        or stored.get("expected_key_points")
        or stored.get("key_points")
        or stored.get("expectedKeywords")
        or []
    )
    keywords = expected_keywords or stored.get("expected_keywords") or key_points

    return {
        "id": question_id or stored.get("id"),
        "questionText": question_text or stored.get("question_text") or stored.get("question") or stored.get("content") or "",
        "topic": stored.get("topic"),
        "difficulty": stored.get("difficulty"),
        "expectedKeywords": list(keywords or []),
        "expectedKeyPoints": list(key_points or []),
        "referenceAnswer": reference_answer or stored.get("ideal_answer") or stored.get("reference_answer") or stored.get("referenceAnswer") or "",
    }
