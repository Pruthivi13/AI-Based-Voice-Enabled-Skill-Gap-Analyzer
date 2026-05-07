"""
Keyword and concept extraction.

Uses spaCy and NLTK when available, but keeps a deterministic regex fallback so
the project still runs on fresh student machines before language models are
downloaded.
"""

from __future__ import annotations

import re
from collections import Counter
from functools import lru_cache
from typing import Iterable

from utils.logger import setup_logger

logger = setup_logger(__name__)

_BASIC_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "because",
    "by",
    "for",
    "from",
    "has",
    "have",
    "i",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "with",
    "you",
}


@lru_cache(maxsize=1)
def _stopwords() -> set[str]:
    try:
        from nltk.corpus import stopwords

        return set(stopwords.words("english")) | _BASIC_STOPWORDS
    except Exception:
        return _BASIC_STOPWORDS


@lru_cache(maxsize=1)
def _nlp():
    try:
        import spacy

        try:
            return spacy.load("en_core_web_sm")
        except OSError:
            logger.warning(
                "spaCy model en_core_web_sm is not installed; using blank English pipeline"
            )
            return spacy.blank("en")
    except Exception as exc:
        logger.warning("spaCy unavailable, using regex keyword fallback: %s", exc)
        return None


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9+#.\s-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(text: str) -> list[str]:
    nlp = _nlp()
    stops = _stopwords()
    if nlp:
        doc = nlp(text)
        words = []
        for token in doc:
            value = (token.lemma_ or token.text).lower().strip()
            if (
                len(value) > 1
                and not token.is_punct
                and not token.is_space
                and value not in stops
            ):
                words.append(value)
        return words

    return [
        word
        for word in re.findall(r"[a-zA-Z0-9+#.]+", text.lower())
        if len(word) > 1 and word not in stops
    ]


def _important_phrases(text: str) -> list[str]:
    nlp = _nlp()
    if not nlp:
        return []

    doc = nlp(text)
    phrases: list[str] = []
    if hasattr(doc, "noun_chunks"):
        try:
            phrases.extend(_normalize(chunk.text) for chunk in doc.noun_chunks)
        except Exception:
            pass

    for token in doc:
        if token.pos_ in {"NOUN", "PROPN", "ADJ"} and not token.is_stop:
            phrases.append(_normalize(token.text))
    return [p for p in phrases if p]


def _phrase_present(transcript_norm: str, phrase: str) -> bool:
    phrase_norm = _normalize(phrase)
    if not phrase_norm:
        return False
    if phrase_norm in transcript_norm:
        return True

    phrase_tokens = set(_tokens(phrase_norm))
    transcript_tokens = set(_tokens(transcript_norm))
    if not phrase_tokens:
        return False
    overlap = len(phrase_tokens & transcript_tokens) / len(phrase_tokens)
    return overlap >= 0.6


def extract_keywords(
    transcript: str,
    expected_keywords: Iterable[str] | None = None,
    expected_key_points: Iterable[str] | None = None,
    top_n: int = 12,
) -> dict:
    """
    Extract visible keywords and compare the transcript to expected concepts.
    """
    transcript = transcript or ""
    expected_keywords = list(expected_keywords or [])
    expected_key_points = list(expected_key_points or [])
    expected_terms = list(dict.fromkeys(expected_keywords + expected_key_points))

    words = _tokens(transcript)
    frequencies = Counter(words)
    phrase_candidates = _important_phrases(transcript)

    extracted = []
    for phrase, _ in Counter(phrase_candidates + words).most_common(top_n * 2):
        if phrase and phrase not in extracted:
            extracted.append(phrase)
        if len(extracted) >= top_n:
            break

    transcript_norm = _normalize(transcript)
    found = [term for term in expected_terms if _phrase_present(transcript_norm, term)]
    missing = [term for term in expected_terms if term not in found]
    coverage = round((len(found) / len(expected_terms)) * 100, 1) if expected_terms else 0.0

    return {
        "extractedKeywords": extracted,
        "keywordsFound": found,
        "missingKeywords": missing,
        "keywordCoveragePercent": coverage,
        "termFrequencies": dict(frequencies.most_common(top_n)),
        # Claude-style aliases used by the standalone architecture notes.
        "found_keywords": found,
        "missing_keywords": missing,
        "coverage_score": round(coverage / 100, 3),
        "extracted_concepts": extracted,
        "keyword_score": round(coverage / 10, 1),
    }
