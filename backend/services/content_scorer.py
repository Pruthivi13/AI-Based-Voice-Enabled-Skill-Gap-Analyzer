"""
content_scorer.py — Hybrid content evaluation using the fine-tuned binary model.

Loads interview_content_model_binary and scores transcripts
using keyword overlap + model prediction (hybrid logic).
"""
import os
import re
from typing import Optional
from utils.logger import setup_logger

logger = setup_logger(__name__)

# ── Model singleton ──────────────────────────────────────────────────────────
_model = None
_tokenizer = None

# Resolve from project root regardless of working directory
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.normpath(
    os.path.join(_THIS_DIR, "../../models/interview_content_model_binary")
)


def get_scorer_model():
    global _model, _tokenizer
    if _model is None:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        import torch
        logger.info(f"Loading content model from: {MODEL_PATH}")
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        _model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
        _model.eval()
        logger.info("Content model loaded.")
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


def model_predict_binary(question: str, answer: str) -> str:
    """
    Run the fine-tuned model on question + answer.
    Returns 'STRONG' or 'NOT_STRONG'.
    Reads label mapping directly from model config.
    """
    import torch
    model, tokenizer = get_scorer_model()

    input_text = f"Question: {question} Answer: {answer}"
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

    logger.debug(f"Raw model label: {raw_label} (class index: {predicted_class})")

    # Normalise whatever label name to STRONG / NOT_STRONG
    if any(x in raw_label for x in ["STRONG", "1", "GOOD", "CORRECT", "POSITIVE"]):
        # Check it's not NOT_STRONG first
        if "NOT" in raw_label or "WEAK" in raw_label or "BAD" in raw_label:
            return "NOT_STRONG"
        return "STRONG"
    return "NOT_STRONG"

def hybrid_score(question: str, answer: str, reference: str) -> dict:
    """
    Hybrid scoring — keyword overlap carries most weight since
    the binary model acts as a weak signal.

    Rules:
    - overlap >= 0.7                          → STRONG
    - overlap >= 0.4  OR model says STRONG    → AVERAGE  
    - everything else                         → WEAK
    """
    model_label = model_predict_binary(question, answer)
    overlap = keyword_overlap(answer, reference)
    answer_length = len(clean_words(answer))

    if overlap >= 0.7 or (model_label == "STRONG" and overlap >= 0.3):
        final_score = "STRONG"
    elif overlap >= 0.4 or model_label == "STRONG":
        final_score = "AVERAGE"
    else:
        final_score = "WEAK"

    return {
        "model_label": model_label,
        "keyword_overlap": overlap,
        "answer_length": answer_length,
        "final_score": final_score,
    }



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


def evaluate_answer(question: str, answer: str, reference: str) -> dict:
    """
    Full evaluation pipeline.
    Returns the complete scoring result dict.
    """
    logger.info(f"Evaluating answer for question: {question[:60]}...")
    scores = hybrid_score(question, answer, reference)
    feedback = generate_feedback(
        scores["final_score"],
        scores["keyword_overlap"],
        scores["answer_length"],
    )
    return {**scores, "feedback": feedback}
