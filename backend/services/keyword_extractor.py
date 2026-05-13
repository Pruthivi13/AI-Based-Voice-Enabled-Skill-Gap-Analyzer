"""
Keyword and concept extraction.

Uses spaCy and NLTK when available, with deterministic regex fallbacks so the
API still works on machines that have not downloaded language assets yet.
"""
from __future__ import annotations

import re
import os
from collections import Counter
from functools import lru_cache
from typing import Any, Optional

DEFAULT_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "because", "but", "by",
    "can", "do", "does", "for", "from", "had", "has", "have", "how",
    "i", "if", "in", "into", "is", "it", "its", "of", "on", "or",
    "our", "should", "so", "that", "the", "their", "then", "there",
    "these", "they", "this", "to", "was", "we", "were", "what",
    "when", "where", "which", "while", "who", "why", "will", "with",
    "you", "your",
}

CONCEPT_HELPER_WORDS = {
    "common",
    "commonly",
    "include",
    "includes",
    "including",
    "usually",
    "generally",
    "often",
    "main",
    "method",
    "methods",
    "important",
    "key",
    "briefly",
    "explain",
    "describe",
}


@lru_cache(maxsize=1)
def _load_stopwords() -> set[str]:
    try:
        from nltk.corpus import stopwords

        return set(stopwords.words("english")) | DEFAULT_STOPWORDS
    except Exception:
        return DEFAULT_STOPWORDS


@lru_cache(maxsize=1)
def _load_spacy_model():
    try:
        import spacy

        try:
            return spacy.load("en_core_web_sm")
        except Exception:
            return spacy.blank("en")
    except Exception:
        return None


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _simple_tokens(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9+#]*", text.lower())


def _canonical_token(token: str) -> str:
    token = token.lower()
    if token == "apis":
        return "api"
    if len(token) > 4 and token.endswith("ies"):
        return f"{token[:-3]}y"
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def _concept_tokens(text: str) -> list[str]:
    stopwords = _load_stopwords() | CONCEPT_HELPER_WORDS
    return [
        _canonical_token(token)
        for token in _simple_tokens(text)
        if _canonical_token(token) not in stopwords
    ]


def _phrase_present(phrase: str, transcript: str) -> bool:
    return _phrase_match_details(phrase, transcript)["matched"]


def _fuzzy_similarity(phrase: str, transcript: str) -> float:
    try:
        from rapidfuzz import fuzz
    except Exception:
        return 0.0

    normalized_phrase = _normalize(phrase)
    normalized_transcript = _normalize(transcript)
    if not normalized_phrase or not normalized_transcript:
        return 0.0

    # token_set_ratio handles reordered phrases and extra words well, which is
    # exactly what interview answers tend to contain.
    return float(fuzz.token_set_ratio(normalized_phrase, normalized_transcript))


def _phrase_match_details(
    phrase: str,
    transcript: str,
    fuzzy_threshold: Optional[float] = None,
) -> dict[str, Any]:
    normalized_phrase = _normalize(phrase)
    normalized_transcript = _normalize(transcript)
    if not normalized_phrase:
        return {"matched": False, "method": "empty", "score": 0.0}

    # Exact phrase match first.
    if re.search(rf"(?<![a-z0-9]){re.escape(normalized_phrase)}(?![a-z0-9])", normalized_transcript):
        return {"matched": True, "method": "exact_phrase", "score": 100.0}

    # Then a forgiving all-token check for short concept phrases.
    phrase_tokens = _concept_tokens(normalized_phrase)
    transcript_tokens = set(_concept_tokens(normalized_transcript))
    if bool(phrase_tokens) and all(token in transcript_tokens for token in phrase_tokens):
        return {"matched": True, "method": "all_tokens", "score": 92.0}

    threshold = (
        fuzzy_threshold
        if fuzzy_threshold is not None
        else float(os.getenv("KEYWORD_FUZZY_THRESHOLD", "86"))
    )
    fuzzy_score = _fuzzy_similarity(normalized_phrase, normalized_transcript)
    return {
        "matched": fuzzy_score >= threshold,
        "method": "rapidfuzz" if fuzzy_score else "none",
        "score": round(fuzzy_score, 2),
    }


def _extract_terms_with_spacy(text: str) -> list[str]:
    nlp = _load_spacy_model()
    stopwords = _load_stopwords()
    if nlp is None:
        return []

    doc = nlp(text)
    terms: list[str] = []

    try:
        noun_chunks = list(getattr(doc, "noun_chunks", []))
    except Exception:
        noun_chunks = []

    for chunk in noun_chunks:
        cleaned = " ".join(
            token.lemma_.lower() if token.lemma_ else token.text.lower()
            for token in chunk
            if token.is_alpha and not token.is_stop
        ).strip()
        if cleaned:
            terms.append(cleaned)

    if terms:
        return terms

    for token in doc:
        token_text = (token.lemma_ or token.text).lower().strip(".,;:!?()[]{}\"'")
        is_candidate_pos = token.pos_ in {"NOUN", "PROPN", "ADJ"} if token.pos_ else True
        if (
            token_text
            and token_text.isascii()
            and token_text not in stopwords
            and len(token_text) > 2
            and is_candidate_pos
        ):
            terms.append(token_text)

    return terms


def _extract_terms_fallback(text: str) -> list[str]:
    stopwords = _load_stopwords()
    return [
        token
        for token in _simple_tokens(text)
        if token not in stopwords and len(token) > 2
    ]


def extract_keywords(
    transcript: str,
    expected_keywords: list[str] | None = None,
    expected_key_points: list[str] | None = None,
    top_n: int = 15,
) -> dict[str, Any]:
    expected_keywords = expected_keywords or []
    expected_key_points = expected_key_points or []

    spacy_terms = _extract_terms_with_spacy(transcript)
    terms = spacy_terms or _extract_terms_fallback(transcript)
    frequencies = Counter(terms)
    extracted_keywords = [term for term, _ in frequencies.most_common(top_n)]

    keyword_threshold = float(os.getenv("KEYWORD_FUZZY_THRESHOLD", "86"))
    key_point_threshold = float(os.getenv("KEY_POINT_FUZZY_THRESHOLD", "72"))

    keyword_matches = {
        keyword: _phrase_match_details(keyword, transcript, keyword_threshold)
        for keyword in expected_keywords
    }
    key_point_matches = {
        point: _phrase_match_details(point, transcript, key_point_threshold)
        for point in expected_key_points
    }

    keywords_found = [
        keyword for keyword, match in keyword_matches.items() if match["matched"]
    ]
    missing_keywords = [
        keyword for keyword in expected_keywords if keyword not in keywords_found
    ]

    key_points_found = [
        point for point, match in key_point_matches.items() if match["matched"]
    ]
    missing_key_points = [
        point for point in expected_key_points if point not in key_points_found
    ]

    keyword_score = (
        round((len(keywords_found) / len(expected_keywords)) * 10, 2)
        if expected_keywords
        else 0.0
    )
    concept_score = (
        round((len(key_points_found) / len(expected_key_points)) * 10, 2)
        if expected_key_points
        else keyword_score
    )

    return {
        "keywords_found": keywords_found,
        "missing_keywords": missing_keywords,
        "key_points_found": key_points_found,
        "missing_key_points": missing_key_points,
        "extracted_keywords": extracted_keywords,
        "term_frequencies": dict(frequencies.most_common(top_n)),
        "keyword_score": keyword_score,
        "concept_score": concept_score,
        "used_spacy": bool(spacy_terms),
        "used_rapidfuzz": any(
            match["method"] == "rapidfuzz"
            for match in [*keyword_matches.values(), *key_point_matches.values()]
        ),
        "keyword_match_scores": keyword_matches,
        "key_point_match_scores": key_point_matches,
    }
