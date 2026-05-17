"""
content_scorer.py — Hybrid content evaluation using the fine-tuned binary model.

Loads interview_content_model_binary and scores transcripts
using keyword overlap + model prediction (hybrid logic).
Falls back to local SentenceTransformer similarity when the
fine-tuned weights are not present.

Set CONTENT_SCORER_BACKEND=semantic in .env to skip the
transformer model entirely (useful in dev / CI environments).
"""
from __future__ import annotations

import os
import re
from math import sqrt
from pathlib import Path
from typing import Any, Optional
from utils.logger import setup_logger


def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    try:
        from dotenv import load_dotenv

        load_dotenv(dotenv_path=env_path)
        return
    except ImportError:
        pass

    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key not in {"CONTENT_SCORER_BACKEND", "CONTENT_SCORER_MODEL_PATH"}:
            continue
        os.environ.setdefault(key, value.strip().strip("\"'"))


_load_env_file()

logger = setup_logger(__name__)

# ── Model singleton ──────────────────────────────────────────────────────────
_model = None
_tokenizer = None

# ── One-time availability flag (avoids re-logging on every request) ──────────
_model_available: Optional[bool] = None

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.environ.get(
    "CONTENT_SCORER_MODEL_PATH",
    os.path.normpath(
        os.path.join(_THIS_DIR, "../../models/interview_content_model_binary")
    ),
)
MODEL_WEIGHT_FILES = (
    "pytorch_model.bin",
    "model.safetensors",
    "tf_model.h5",
    "flax_model.msgpack",
)

# Set CONTENT_SCORER_BACKEND=semantic to always use the local fallback
_FORCE_SEMANTIC = os.environ.get("CONTENT_SCORER_BACKEND", "").lower() == "semantic"


def _model_files_present() -> bool:
    return os.path.isdir(MODEL_PATH) and any(
        os.path.exists(os.path.join(MODEL_PATH, filename))
        for filename in MODEL_WEIGHT_FILES
    )


def _check_model_available() -> bool:
    """
    Checks model availability once and caches the result.
    Logs only on first call so warnings don't spam on every request.
    """
    global _model_available
    if _model_available is not None:
        return _model_available

    if _FORCE_SEMANTIC:
        logger.info(
            "CONTENT_SCORER_BACKEND=semantic - skipping transformer model, "
            "using local semantic scorer."
        )
        _model_available = False
        return False

    if not _model_files_present():
        logger.warning(
            "Content scorer weights not found at '%s'. "
            "Using local semantic similarity as fallback. "
            "To silence this, set CONTENT_SCORER_BACKEND=semantic in your .env, "
            "or place model weights at the path above.",
            MODEL_PATH,
        )
        _model_available = False
        return False

    _model_available = True
    return True


def get_scorer_model():
    global _model, _tokenizer
    if _model is None:
        if not _check_model_available():
            raise FileNotFoundError(
                f"Content scorer weights were not found in {MODEL_PATH}"
            )
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        import torch
        logger.info(f"Loading content model from: {MODEL_PATH}")
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        _model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
        torch.set_grad_enabled(False)
        _model.eval()
        logger.info("Content model loaded successfully.")
    return _model, _tokenizer


# ── Helper functions ─────────────────────────────────────────────────────────

def clean_words(text: str) -> list:
    """Lowercase, strip punctuation, split into words."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return text.split()


def keyword_overlap(answer: str, reference: str) -> float:
    """Jaccard-style overlap between answer and reference word sets."""
    answer_words = set(clean_words(answer))
    ref_words = set(clean_words(reference))
    if not ref_words:
        return 0.0
    intersection = answer_words & ref_words
    return round(len(intersection) / len(ref_words), 3)


def _clamp(value: float, minimum: float = 0.0, maximum: float = 10.0) -> float:
    return max(minimum, min(maximum, value))


def _reference_coverage(answer: str, reference: str) -> float:
    answer_words = set(clean_words(answer))
    reference_words = set(clean_words(reference))
    if not reference_words:
        return 0.0
    return len(answer_words & reference_words) / len(reference_words)


def _cosine_from_counts(left: dict[str, int], right: dict[str, int]) -> float:
    keys = set(left) | set(right)
    if not keys:
        return 0.0
    dot = sum(left.get(key, 0) * right.get(key, 0) for key in keys)
    left_norm = sqrt(sum(value * value for value in left.values()))
    right_norm = sqrt(sum(value * value for value in right.values()))
    if not left_norm or not right_norm:
        return 0.0
    return dot / (left_norm * right_norm)


def _ngram_counts(text: str) -> dict[str, int]:
    words = clean_words(text)
    counts: dict[str, int] = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    for first, second in zip(words, words[1:]):
        key = f"{first} {second}"
        counts[key] = counts.get(key, 0) + 1
    return counts


_st_model = None


def get_sentence_transformer():
    global _st_model
    if _st_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading SentenceTransformer ('all-MiniLM-L6-v2') for semantic scoring...")
            _st_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("SentenceTransformer loaded successfully.")
        except ImportError:
            logger.warning("sentence-transformers not installed. Falling back to ngram cosine similarity.")
            return None
    return _st_model


def semantic_similarity(answer: str, reference: str) -> float:
    """
    Local semantic similarity for environments where the fine-tuned weights are
    not present. Uses SentenceTransformers, with a deterministic
    unigram/bigram cosine fallback.
    """
    answer = answer or ""
    reference = reference or ""
    if not clean_words(answer) or not clean_words(reference):
        return 0.0

    st_model = get_sentence_transformer()
    if st_model is not None:
        try:
            from sentence_transformers import util
            embeddings1 = st_model.encode(answer, convert_to_tensor=True)
            embeddings2 = st_model.encode(reference, convert_to_tensor=True)
            cosine_score = util.cos_sim(embeddings1, embeddings2)
            return round(float(cosine_score[0][0]), 3)
        except Exception as error:
            logger.debug("SentenceTransformer inference failed: %s", error)

    return round(_cosine_from_counts(_ngram_counts(answer), _ngram_counts(reference)), 3)


def _score_from_signals(
    overlap: float,
    semantic: float,
    answer_length: int,
    model_label: str,
) -> float:
    coverage_component = max(overlap, semantic * 0.9)
    model_component = 0.82 if model_label == "STRONG" else 0.35
    length_component = min(answer_length / 45, 1.0)
    return round(
        _clamp(
            (
                coverage_component * 0.52
                + semantic * 0.34
                + model_component * 0.12
                + length_component * 0.02
            )
            * 10
        ),
        2,
    )


def _score_to_label(score: float) -> str:
    if score >= 7.5:
        return "STRONG"
    if score >= 5.0:
        return "AVERAGE"
    return "WEAK"


def model_predict_binary(question: str, answer: str) -> str:
    """
    Run the fine-tuned model on question + answer.
    Returns 'STRONG' or 'NOT_STRONG'.
    Reads label mapping directly from model config.
    """
    import torch
    model, tokenizer = get_scorer_model()

    input_text = f"Question: {question} Answer: {answer}"
    try:
        token_count = len(
            tokenizer(input_text, add_special_tokens=True, truncation=False)["input_ids"]
        )
        if token_count > 512:
            logger.info(
                "Content model input has %d tokens and will be truncated to 512.",
                token_count,
            )
    except Exception as error:
        logger.debug("Could not estimate content model token count: %s", error)

    inputs = tokenizer(
        input_text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )
    # DistilBERT does not accept token_type_ids
    inputs.pop("token_type_ids", None)
    with torch.no_grad():
        outputs = model(**inputs)

    predicted_class = outputs.logits.argmax(dim=-1).item()

    # Read the actual label from model config instead of hardcoding
    id2label = getattr(model.config, "id2label", {0: "LABEL_0", 1: "LABEL_1"})
    raw_label = id2label.get(predicted_class, str(predicted_class)).upper()

    logger.debug("Raw model label: %s (class index: %d)", raw_label, predicted_class)

    # Normalise whatever label name to STRONG / NOT_STRONG
    if any(x in raw_label for x in ["STRONG", "1", "GOOD", "CORRECT", "POSITIVE"]):
        # Check it's not NOT_STRONG first
        if "NOT" in raw_label or "WEAK" in raw_label or "BAD" in raw_label:
            return "NOT_STRONG"
        return "STRONG"
    return "NOT_STRONG"

def hybrid_score(
    question: str,
    answer: str,
    reference: str,
    keywords_text: str = "",
) -> dict:
    """
    Hybrid scoring.
    If the fine-tuned model is unavailable, uses semantic similarity only.
    The unavailability check is cached after the first call.
    """
    model_error: Optional[str] = None
    model_label: Optional[str] = None
    scorer_backend = "transformer"

    if not _check_model_available():
        model_error = "model_not_found"
        scorer_backend = "local_semantic"
    else:
        try:
            model_label = model_predict_binary(question, answer)
        except Exception as error:
            model_error = str(error)
            scorer_backend = "local_semantic"
            logger.debug("Transformer probe failed, using local semantic: %s", error)

    overlap_vs_answer = keyword_overlap(answer, reference)
    if keywords_text:
        overlap_vs_keywords = keyword_overlap(answer, keywords_text)
        overlap = max(overlap_vs_answer, overlap_vs_keywords)
    else:
        overlap = overlap_vs_answer

    semantic = semantic_similarity(answer, reference)
    answer_length = len(clean_words(answer))

    if model_error:
        model_label = "STRONG" if semantic >= 0.52 or overlap >= 0.55 else "NOT_STRONG"

    content_score = _score_from_signals(
        overlap=overlap,
        semantic=semantic,
        answer_length=answer_length,
        model_label=model_label or "NOT_STRONG",
    )
    final_score = _score_to_label(content_score)

    result = {
        "model_label": model_label or "NOT_STRONG",
        "scorer_backend": scorer_backend,
        "keyword_overlap": overlap,
        "semantic_similarity": semantic,
        "reference_coverage": round(_reference_coverage(answer, reference), 3),
        "answer_length": answer_length,
        "final_score": final_score,
        "content_score": content_score,
    }
    if model_error and model_error != "model_not_found":
        result["model_error"] = model_error
    return result



def generate_feedback(final_score: str, overlap: float, answer_length: int) -> str:
    """Generate a short feedback string based on score."""
    if final_score == "STRONG":
        return "Your answer is relevant and covers the main points clearly."
    elif final_score == "AVERAGE":
        if overlap < 0.4:
            return "Your answer is on topic but misses some key concepts. Try to be more specific."
        return "Good effort! Add more detail and technical depth to strengthen your answer."
    else:
        if answer_length < 10:
            return "Your answer is too short. Try to elaborate with examples and details."
        return "Your answer needs improvement. Focus on the core concepts and use relevant terminology."


def _reference_with_expected_terms(
    reference: str,
    expected_key_points: list[str] | None = None,
) -> str:
    parts = [reference or ""]
    if expected_key_points:
        parts.extend(expected_key_points)
    return " ".join(part for part in parts if part).strip()


def evaluate_answer(
    question: str,
    answer: str,
    reference: str,
    expected_keywords: list[str] | None = None,
    expected_key_points: list[str] | None = None,
) -> dict[str, Any]:
    """
    Full evaluation pipeline.
    Returns the complete scoring result dict.
    """
    logger.info("Evaluating answer for question: %s...", question[:60])
    reference_text = _reference_with_expected_terms(
        reference,
        expected_key_points=expected_key_points,
    )
    keywords_text = " ".join(expected_keywords or [])

    if not clean_words(reference_text) and not clean_words(keywords_text):
        return {
            "model_label": "SKIPPED",
            "scorer_backend": "skipped",
            "keyword_overlap": 0.0,
            "answer_length": len(clean_words(answer)),
            "final_score": "UNSCORED",
            "content_score": None,
            "feedback": "No reference answer or expected keywords were available for content-model scoring.",
        }
    scores = hybrid_score(question, answer, reference_text, keywords_text)
    feedback = generate_feedback(
        scores["final_score"],
        scores["keyword_overlap"],
        scores["answer_length"],
    )
    return {**scores, "feedback": feedback}
