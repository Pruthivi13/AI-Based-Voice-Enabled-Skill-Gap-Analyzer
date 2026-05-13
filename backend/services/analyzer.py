"""
Response analyzer — scores transcript across multiple dimensions.
Runs the same LLM/content/audio evaluator used by the main analysis pipeline.
"""
from __future__ import annotations

import asyncio
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from utils.logger import setup_logger

logger = setup_logger(__name__)

ALLOWED_AUDIO_SUFFIXES = {".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg"}

def count_filler_words(text: str) -> int:
    """Count filler words in transcript."""
    fillers = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 
               'literally', 'right', 'so yeah', 'kind of', 'sort of']
    text_lower = text.lower()
    count = sum(text_lower.count(filler) for filler in fillers)
    return count

def calculate_speech_rate(text: str, duration_seconds: int = 60) -> int:
    """Estimate words per minute."""
    word_count = len(text.split())
    wpm = int((word_count / duration_seconds) * 60)
    return min(wpm, 300)  # cap at 300 wpm

def score_clarity(text: str) -> float:
    """Score based on sentence structure and length."""
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if not sentences:
        return 5.0
    
    avg_length = sum(len(s.split()) for s in sentences) / len(sentences)
    
    # Ideal sentence length is 15-25 words
    if 15 <= avg_length <= 25:
        score = 9.0
    elif 10 <= avg_length <= 30:
        score = 7.5
    else:
        score = 6.0
    
    return round(score, 1)

def score_fluency(text: str) -> float:
    """Score based on filler words and repetition."""
    filler_count = count_filler_words(text)
    word_count = len(text.split())
    
    if word_count == 0:
        return 5.0
    
    filler_ratio = filler_count / word_count
    
    if filler_ratio < 0.02:
        score = 9.0
    elif filler_ratio < 0.05:
        score = 7.5
    elif filler_ratio < 0.10:
        score = 6.0
    else:
        score = 4.5
    
    return round(score, 1)

def score_confidence(text: str) -> float:
    """Score based on confident language patterns."""
    confident_phrases = [
        'i believe', 'i think', 'in my experience', 'i know',
        'definitely', 'certainly', 'absolutely', 'i am confident',
        'i have', 'i did', 'i built', 'i worked'
    ]
    uncertain_phrases = [
        'i guess', 'maybe', 'perhaps', 'i\'m not sure', 'i don\'t know',
        'possibly', 'might be', 'could be', 'i think maybe'
    ]
    
    text_lower = text.lower()
    confident_count = sum(1 for p in confident_phrases if p in text_lower)
    uncertain_count = sum(1 for p in uncertain_phrases if p in text_lower)
    
    base_score = 7.0
    base_score += confident_count * 0.3
    base_score -= uncertain_count * 0.4
    
    return round(min(max(base_score, 4.0), 10.0), 1)

def score_relevance(text: str) -> float:
    """Score based on text length and substance."""
    word_count = len(text.split())
    
    if word_count < 20:
        return 4.0
    elif word_count < 50:
        return 6.0
    elif word_count < 150:
        return 8.0
    else:
        return 9.0

def score_technical(text: str) -> float:
    """Score based on technical terminology usage."""
    technical_terms = [
        'algorithm', 'api', 'database', 'function', 'component',
        'framework', 'library', 'architecture', 'performance', 'optimization',
        'scalability', 'security', 'testing', 'deployment', 'integration',
        'interface', 'protocol', 'server', 'client', 'async', 'promise',
        'state', 'props', 'hook', 'class', 'object', 'array', 'method',
        'endpoint', 'request', 'response', 'authentication', 'authorization'
    ]
    
    text_lower = text.lower()
    term_count = sum(1 for term in technical_terms if term in text_lower)
    
    if term_count >= 5:
        return 9.0
    elif term_count >= 3:
        return 7.5
    elif term_count >= 1:
        return 6.0
    else:
        return 5.0

def generate_feedback(scores: dict, text: str) -> list:
    """Generate actionable feedback based on scores."""
    feedback = []
    
    if scores['fluencyScore'] < 7:
        feedback.append("Reduce filler words like 'um', 'uh', and 'like' for cleaner delivery.")
    
    if scores['clarityScore'] < 7:
        feedback.append("Use shorter, clearer sentences to improve comprehension.")
    
    if scores['confidenceScore'] < 7:
        feedback.append("Use more assertive language — replace 'I think maybe' with 'I believe'.")
    
    if scores['technicalScore'] < 7:
        feedback.append("Include more technical terminology to demonstrate depth of knowledge.")
    
    if scores['relevanceScore'] < 7:
        feedback.append("Provide more detailed answers with specific examples.")
    
    if len(text.split()) < 50:
        feedback.append("Try to elaborate more — aim for at least 2-3 sentences per point.")
    
    if not feedback:
        feedback.append("Great answer! Keep up the structured and confident delivery.")
    
    return feedback


def _download_audio_url(audio_url: str) -> str:
    suffix = Path(urlparse(audio_url).path).suffix.lower()
    if suffix not in ALLOWED_AUDIO_SUFFIXES:
        suffix = ".webm"

    request = Request(audio_url, headers={"User-Agent": "AI-Interview-Evaluator/1.0"})
    with urlopen(request, timeout=45) as response:
        contents = response.read()
    if not contents:
        raise ValueError("Downloaded audio file is empty")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contents)
        return tmp.name


def _numeric(value: Any, default: float | None = None) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _pipeline_to_legacy_analysis(response_id: str, final_result: dict[str, Any]) -> dict:
    content = final_result.get("content_scores", {})
    delivery = final_result.get("delivery_scores", {})
    audio = final_result.get("audio_metrics", {})

    correctness = _numeric(content.get("correctness"), 0.0) or 0.0
    completeness = _numeric(content.get("completeness"), 0.0) or 0.0
    technical = round((correctness + completeness) / 2, 1)
    wpm = _numeric(audio.get("words_per_minute"))
    has_audio_wpm = bool(audio.get("audio_available")) and wpm is not None and wpm > 0

    feedback = [
        final_result.get("feedback"),
        *list(final_result.get("improvements", [])),
    ]
    if audio.get("audio_available"):
        if has_audio_wpm:
            feedback.append(f"Speaking speed: {round(wpm or 0)} WPM from recorded audio.")
        if audio.get("pause_count") is not None:
            feedback.append(
                f"Pause analysis: {audio.get('pause_count')} pause(s), "
                f"{audio.get('long_pause_count', 0)} long pause(s)."
            )
    else:
        feedback.append(
            "Delivery timing needs recorded audio; transcript-only analysis cannot measure real pauses."
        )

    return {
        "responseId": response_id,
        "clarityScore": content.get("clarity"),
        "fluencyScore": delivery.get("fluency"),
        "confidenceScore": delivery.get("confidence_cues"),
        "relevanceScore": content.get("relevance"),
        "grammarScore": content.get("clarity"),
        "pronunciationScore": delivery.get("voice_quality") or delivery.get("delivery"),
        "technicalScore": technical,
        "fillerWordCount": audio.get("filler_count"),
        "speechRateWpm": round(wpm) if has_audio_wpm else None,
        "sentiment": "positive" if final_result.get("label") == "STRONG" else "neutral",
        "overallScore": final_result.get("overall_score"),
        "feedbackJson": [item for item in feedback if item],
        "pipelineResult": final_result,
    }


async def analyze_transcript(
    response_id: str,
    transcript: str,
    question_text: Optional[str] = None,
    audio_url: Optional[str] = None,
    audio_path: Optional[str] = None,
    expected_keywords: Optional[list[str]] = None,
    expected_key_points: Optional[list[str]] = None,
    ideal_answer: str = "",
    stt_segments: Optional[list[dict[str, Any]]] = None,
) -> dict:
    """
    Analyzes a transcript and returns scores across multiple dimensions.
    
    Args:
        response_id: ID of the response
        transcript: Transcribed text to analyze
        question_text: Interview question being answered
        audio_url/audio_path: Optional recorded audio for delivery metrics
        expected_keywords/expected_key_points/ideal_answer: Reference rubric
        
    Returns:
        dict: Analysis scores and feedback
    """
    logger.info(f"Analyzing transcript for response: {response_id}")
    expected_keywords = expected_keywords or []
    expected_key_points = expected_key_points or []
    question_text = question_text or "Interview question"
    
    if (not transcript or len(transcript.strip()) < 5) and not (audio_url or audio_path):
        logger.warning("Empty or very short transcript received")
        return {
            "responseId": response_id,
            "clarityScore": 5.0,
            "fluencyScore": 5.0,
            "confidenceScore": 5.0,
            "relevanceScore": 5.0,
            "grammarScore": 5.0,
            "pronunciationScore": 5.0,
            "technicalScore": 5.0,
            "fillerWordCount": 0,
            "speechRateWpm": 0,
            "sentiment": "neutral",
            "overallScore": 5.0,
            "feedbackJson": ["No transcript available for analysis."]
        }

    from backend.services.audio_analysis import analyze_audio
    from backend.services.content_scorer import evaluate_answer as evaluate_content_model
    from backend.services.keyword_extractor import extract_keywords
    from backend.services.llm_service import evaluate_content
    from backend.services.scoring import build_final_result
    from backend.services.stt_service import transcribe_file

    downloaded_audio_path: Optional[str] = None
    if not audio_path and audio_url:
        try:
            loop = asyncio.get_event_loop()
            downloaded_audio_path = await loop.run_in_executor(
                None,
                lambda: _download_audio_url(audio_url),
            )
            audio_path = downloaded_audio_path
        except Exception as error:
            logger.warning("Could not download audio for response %s: %s", response_id, error)

    try:
        loop = asyncio.get_event_loop()
        if (not transcript or len(transcript.strip()) < 5) and audio_path:
            stt_result = await loop.run_in_executor(
                None,
                lambda: transcribe_file(audio_path or ""),
            )
            transcript = str(stt_result.get("transcript") or "").strip()
            if not stt_segments:
                stt_segments = stt_result.get("segments") or []

        if not transcript or len(transcript.strip()) < 5:
            logger.warning("No usable transcript available after audio transcription")
            return {
                "responseId": response_id,
                "clarityScore": 5.0,
                "fluencyScore": 5.0,
                "confidenceScore": 5.0,
                "relevanceScore": 5.0,
                "grammarScore": 5.0,
                "pronunciationScore": 5.0,
                "technicalScore": 5.0,
                "fillerWordCount": 0,
                "speechRateWpm": 0,
                "sentiment": "neutral",
                "overallScore": 5.0,
                "feedbackJson": ["No transcript available for analysis."],
            }

        if not expected_key_points and ideal_answer:
            expected_key_points = [ideal_answer]

        keyword_result = await loop.run_in_executor(
            None,
            lambda: extract_keywords(
                transcript,
                expected_keywords,
                expected_key_points,
            ),
        )
        audio_metrics = await loop.run_in_executor(
            None,
            lambda: analyze_audio(audio_path, transcript, stt_segments or []),
        )
        llm_result = await loop.run_in_executor(
            None,
            lambda: evaluate_content(
                question_text=question_text or "",
                transcript=transcript,
                expected_keywords=expected_keywords,
                expected_key_points=expected_key_points,
                ideal_answer=ideal_answer,
                keyword_result=keyword_result,
            ),
        )
        try:
            content_model_result = await loop.run_in_executor(
                None,
                lambda: evaluate_content_model(
                    question=question_text or "",
                    answer=transcript,
                    reference=ideal_answer,
                    expected_keywords=expected_keywords,
                    expected_key_points=expected_key_points,
                ),
            )
        except Exception as error:
            logger.warning("Content model scoring failed: %s", error)
            content_model_result = None

        question = {
            "id": response_id,
            "question_text": question_text,
            "content": question_text,
            "expected_keywords": expected_keywords,
            "expected_key_points": expected_key_points,
            "ideal_answer": ideal_answer,
        }
        final_result = build_final_result(
            question=question,
            transcript=transcript,
            keyword_result=keyword_result,
            llm_result=llm_result,
            audio_metrics=audio_metrics,
            content_model_result=content_model_result,
        )
        result = _pipeline_to_legacy_analysis(response_id, final_result)
        logger.info("Analysis complete. Overall score: %s", result["overallScore"])
        return result
    finally:
        if downloaded_audio_path and os.path.exists(downloaded_audio_path):
            os.unlink(downloaded_audio_path)
