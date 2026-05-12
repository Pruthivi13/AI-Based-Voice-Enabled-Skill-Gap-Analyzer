"""
Small SQLite persistence layer for the FastAPI evaluator MVP.

This mirrors the proposed tables without requiring the TypeScript Prisma service
to be running during ML-service-only demos.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
STORAGE_DIR = PROJECT_ROOT / "backend" / "storage"
DB_PATH = STORAGE_DIR / "interview_evaluator.sqlite3"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    _init_db(connection)
    return connection


def _init_db(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS responses (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            question_id TEXT,
            audio_path TEXT,
            transcript TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS audio_metrics (
            id TEXT PRIMARY KEY,
            response_id TEXT,
            duration_seconds REAL,
            words_per_minute REAL,
            pause_count INTEGER,
            long_pause_count INTEGER,
            filler_count INTEGER,
            fluency_score REAL,
            confidence_cue_score REAL,
            raw_metrics_json TEXT,
            created_at TEXT,
            FOREIGN KEY(response_id) REFERENCES responses(id)
        );

        CREATE TABLE IF NOT EXISTS llm_evaluations (
            id TEXT PRIMARY KEY,
            response_id TEXT,
            keywords_found_json TEXT,
            missing_keywords_json TEXT,
            relevance_score REAL,
            correctness_score REAL,
            completeness_score REAL,
            clarity_score REAL,
            summary_feedback TEXT,
            raw_llm_json TEXT,
            created_at TEXT,
            FOREIGN KEY(response_id) REFERENCES responses(id)
        );

        CREATE TABLE IF NOT EXISTS final_results (
            id TEXT PRIMARY KEY,
            response_id TEXT,
            content_score REAL,
            delivery_score REAL,
            overall_score REAL,
            final_label TEXT,
            strengths_json TEXT,
            improvements_json TEXT,
            feedback TEXT,
            created_at TEXT,
            FOREIGN KEY(response_id) REFERENCES responses(id)
        );
        """
    )
    connection.commit()


def save_evaluation(
    user_id: str,
    question_id: str,
    audio_path: str | None,
    transcript: str,
    audio_metrics: dict[str, Any],
    llm_result: dict[str, Any],
    final_result: dict[str, Any],
    response_id: str | None = None,
) -> str:
    response_id = response_id or str(uuid.uuid4())
    created_at = _now()

    with _connect() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO responses
            (id, user_id, question_id, audio_path, transcript, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (response_id, user_id, question_id, audio_path, transcript, created_at),
        )
        connection.execute(
            """
            INSERT INTO audio_metrics
            (id, response_id, duration_seconds, words_per_minute, pause_count,
             long_pause_count, filler_count, fluency_score, confidence_cue_score,
             raw_metrics_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                response_id,
                audio_metrics.get("duration_seconds"),
                audio_metrics.get("words_per_minute"),
                audio_metrics.get("pause_count"),
                audio_metrics.get("long_pause_count"),
                audio_metrics.get("filler_count"),
                audio_metrics.get("scores", {}).get("fluency"),
                audio_metrics.get("scores", {}).get("confidence_cues"),
                json.dumps(audio_metrics),
                created_at,
            ),
        )
        connection.execute(
            """
            INSERT INTO llm_evaluations
            (id, response_id, keywords_found_json, missing_keywords_json,
             relevance_score, correctness_score, completeness_score,
             clarity_score, summary_feedback, raw_llm_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                response_id,
                json.dumps(llm_result.get("keywords_found", [])),
                json.dumps(llm_result.get("missing_keywords", [])),
                llm_result.get("relevance_score"),
                llm_result.get("correctness_score"),
                llm_result.get("completeness_score"),
                llm_result.get("clarity_score"),
                llm_result.get("final_summary"),
                json.dumps(llm_result),
                created_at,
            ),
        )
        connection.execute(
            """
            INSERT INTO final_results
            (id, response_id, content_score, delivery_score, overall_score,
             final_label, strengths_json, improvements_json, feedback, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                response_id,
                final_result.get("content_score"),
                final_result.get("delivery_score"),
                final_result.get("overall_score"),
                final_result.get("label"),
                json.dumps(final_result.get("strengths", [])),
                json.dumps(final_result.get("improvements", [])),
                final_result.get("feedback"),
                created_at,
            ),
        )
        connection.commit()

    return response_id


def list_results_for_user(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT
                r.id AS response_id,
                r.user_id,
                r.question_id,
                r.transcript,
                r.audio_path,
                r.created_at,
                fr.content_score,
                fr.delivery_score,
                fr.overall_score,
                fr.final_label,
                fr.strengths_json,
                fr.improvements_json,
                fr.feedback
            FROM responses r
            LEFT JOIN final_results fr ON fr.response_id = r.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()

    results: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["strengths"] = json.loads(item.pop("strengths_json") or "[]")
        item["improvements"] = json.loads(item.pop("improvements_json") or "[]")
        results.append(item)
    return results
