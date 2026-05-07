"""
Semantic scoring helpers.

Uses Sentence Transformers when a model is locally available. On fresh machines,
falls back to lightweight TF-IDF/token overlap instead of blocking on a model
download.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from dotenv import load_dotenv

from utils.logger import setup_logger

load_dotenv()
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

logger = setup_logger(__name__)

_model = None
_model_failed = False


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"\b[a-zA-Z0-9+#.]+\b", (text or "").lower())
        if len(token) > 2
    }


def get_model():
    global _model, _model_failed
    if _model is not None:
        return _model
    enabled = os.getenv("ENABLE_SENTENCE_TRANSFORMERS", "false").lower() == "true"
    disabled = os.getenv("DISABLE_SENTENCE_TRANSFORMERS", "false").lower() == "true"
    if _model_failed or disabled or not enabled:
        return None

    try:
        from sentence_transformers import SentenceTransformer

        model_name = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
        allow_downloads = os.getenv("ALLOW_MODEL_DOWNLOADS", "false").lower() == "true"
        logger.info("Loading sentence-transformer model: %s", model_name)

        try:
            _model = SentenceTransformer(model_name, local_files_only=not allow_downloads)
        except TypeError:
            _model = SentenceTransformer(model_name)

        logger.info("Sentence-transformer model loaded")
        return _model
    except Exception as exc:
        _model_failed = True
        logger.warning("Sentence-transformer unavailable; using lexical fallback: %s", exc)
        return None


def _tfidf_similarity(text_a: str, text_b: str) -> float:
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        matrix = TfidfVectorizer(stop_words="english").fit_transform([text_a, text_b])
        return round(float(cosine_similarity(matrix[0], matrix[1])[0][0]), 4)
    except Exception:
        a = _tokens(text_a)
        b = _tokens(text_b)
        if not a or not b:
            return 0.0
        return round(len(a & b) / len(a | b), 4)


def compute_semantic_similarity(transcript: str, reference: str) -> float:
    if not transcript or not reference:
        return 0.0

    model = get_model()
    if model is None:
        return _tfidf_similarity(transcript, reference)

    try:
        from sentence_transformers import util

        embeddings = model.encode([transcript, reference], convert_to_tensor=True)
        return round(float(util.cos_sim(embeddings[0], embeddings[1]).item()), 4)
    except Exception as exc:
        logger.warning("Semantic similarity failed; using TF-IDF fallback: %s", exc)
        return _tfidf_similarity(transcript, reference)


def compute_keypoint_coverage(transcript: str, key_points: list[str]) -> dict:
    if not transcript or not key_points:
        return {
            "coveragePercent": 0.0,
            "coveredPoints": [],
            "missedPoints": list(key_points or []),
            "perPointScores": {},
            "engine": "none",
        }

    model = get_model()
    if model is None:
        transcript_tokens = _tokens(transcript)
        covered = []
        missed = []
        per_point_scores = {}

        for point in key_points:
            point_tokens = _tokens(point)
            score = 0.0 if not point_tokens else len(transcript_tokens & point_tokens) / len(point_tokens)
            per_point_scores[point] = round(score, 3)
            if score >= 0.45 or point.lower() in transcript.lower():
                covered.append(point)
            else:
                missed.append(point)

        return {
            "coveragePercent": round(len(covered) / len(key_points) * 100, 1),
            "coveredPoints": covered,
            "missedPoints": missed,
            "perPointScores": per_point_scores,
            "engine": "lexical",
        }

    try:
        from sentence_transformers import util

        transcript_embedding = model.encode(transcript, convert_to_tensor=True)
        covered = []
        missed = []
        per_point_scores = {}

        threshold = float(os.getenv("SEMANTIC_COVERAGE_THRESHOLD", "0.45"))
        for point in key_points:
            point_embedding = model.encode(point, convert_to_tensor=True)
            score = float(util.cos_sim(transcript_embedding, point_embedding).item())
            per_point_scores[point] = round(score, 3)
            if score >= threshold:
                covered.append(point)
            else:
                missed.append(point)

        return {
            "coveragePercent": round(len(covered) / len(key_points) * 100, 1),
            "coveredPoints": covered,
            "missedPoints": missed,
            "perPointScores": per_point_scores,
            "engine": "sentence-transformers",
        }
    except Exception as exc:
        logger.warning("Key point coverage failed; retrying lexical fallback: %s", exc)
        old_disable = os.environ.get("DISABLE_SENTENCE_TRANSFORMERS")
        os.environ["DISABLE_SENTENCE_TRANSFORMERS"] = "true"
        try:
            return compute_keypoint_coverage(transcript, key_points)
        finally:
            if old_disable is None:
                os.environ.pop("DISABLE_SENTENCE_TRANSFORMERS", None)
            else:
                os.environ["DISABLE_SENTENCE_TRANSFORMERS"] = old_disable
