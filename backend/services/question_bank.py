"""
Question bank loader for the AI interview evaluator MVP.

Primary source: data/questions.json.
Fallback source: data/question_bank_v1.csv, normalized into the same shape.
"""
from __future__ import annotations

import csv
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
QUESTIONS_JSON = PROJECT_ROOT / "data" / "questions.json"
QUESTION_CSV = PROJECT_ROOT / "data" / "question_bank_v1.csv"


def _slugify(value: str, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug or fallback


def _keywords_from_text(text: str, limit: int = 10) -> list[str]:
    stopwords = {
        "the", "a", "an", "and", "or", "to", "of", "in", "on", "for",
        "with", "is", "are", "as", "by", "it", "this", "that", "what",
        "why", "how", "when", "where", "from", "can", "be", "using",
        "used", "such", "into", "one", "more", "most",
    }
    words = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]*", text)
    seen: set[str] = set()
    keywords: list[str] = []
    for word in words:
        normalized = word.lower()
        if normalized in stopwords or len(normalized) < 3:
            continue
        if normalized not in seen:
            seen.add(normalized)
            keywords.append(word)
        if len(keywords) >= limit:
            break
    return keywords


def _key_points_from_reference(reference: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", reference.strip())
    points = [part.strip().rstrip(".") for part in parts if part.strip()]
    if points:
        return points[:5]
    return [reference.strip()] if reference.strip() else []


def _normalize_question(raw: dict[str, Any], index: int) -> dict[str, Any]:
    question_text = (
        raw.get("question_text")
        or raw.get("question")
        or raw.get("content")
        or ""
    ).strip()
    ideal_answer = (
        raw.get("ideal_answer")
        or raw.get("reference_answer")
        or raw.get("referenceAnswer")
        or ""
    ).strip()

    expected_keywords = raw.get("expected_keywords") or raw.get("keywords") or []
    if isinstance(expected_keywords, str):
        try:
            expected_keywords = json.loads(expected_keywords)
        except json.JSONDecodeError:
            expected_keywords = [
                item.strip()
                for item in re.split(r"[,;|]", expected_keywords)
                if item.strip()
            ]
    if not expected_keywords:
        expected_keywords = _keywords_from_text(f"{question_text} {ideal_answer}")

    expected_key_points = (
        raw.get("expected_key_points")
        or raw.get("rubric_key_points")
        or raw.get("key_points")
        or []
    )
    if isinstance(expected_key_points, str):
        try:
            expected_key_points = json.loads(expected_key_points)
        except json.JSONDecodeError:
            expected_key_points = [
                item.strip()
                for item in re.split(r"\n|;|\|", expected_key_points)
                if item.strip()
            ]
    if not expected_key_points:
        expected_key_points = _key_points_from_reference(ideal_answer)

    qid = raw.get("id") or f"q_{index}_{_slugify(question_text, 'question')}"
    category = (raw.get("category") or raw.get("topic") or "TECHNICAL").upper()

    return {
        "id": str(qid),
        "question_text": question_text,
        "content": raw.get("content") or question_text,
        "topic": raw.get("topic") or raw.get("category") or "General",
        "category": category,
        "difficulty": (raw.get("difficulty") or "MEDIUM").upper(),
        "expected_keywords": [str(item) for item in expected_keywords],
        "expected_key_points": [str(item) for item in expected_key_points],
        "ideal_answer": ideal_answer,
    }


@lru_cache(maxsize=1)
def load_questions() -> list[dict[str, Any]]:
    if QUESTIONS_JSON.exists():
        with QUESTIONS_JSON.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return [_normalize_question(item, index) for index, item in enumerate(data)]

    if QUESTION_CSV.exists():
        with QUESTION_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        return [_normalize_question(row, index) for index, row in enumerate(rows)]

    return []


def list_questions() -> list[dict[str, Any]]:
    return load_questions()


def get_question(question_id: str) -> dict[str, Any] | None:
    if not question_id:
        return None

    for question in load_questions():
        if question["id"] == question_id:
            return question

    # Also accept numeric indexes for quick local testing.
    if question_id.isdigit():
        index = int(question_id)
        questions = load_questions()
        if 0 <= index < len(questions):
            return questions[index]

    return None
