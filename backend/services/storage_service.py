"""Legacy read-only SQLite result listing for old ML-service-only demos."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
STORAGE_DIR = PROJECT_ROOT / "backend" / "storage"
DB_PATH = STORAGE_DIR / "interview_evaluator.sqlite3"


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
