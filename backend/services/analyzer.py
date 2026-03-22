"""
Response analyzer — scores transcript across multiple dimensions.
Uses keyword matching, sentence structure, and NLP features.
"""
import re
from typing import Optional
from utils.logger import setup_logger

logger = setup_logger(__name__)

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

async def analyze_transcript(response_id: str, transcript: str) -> dict:
    """
    Analyzes a transcript and returns scores across multiple dimensions.
    
    Args:
        response_id: ID of the response
        transcript: Transcribed text to analyze
        
    Returns:
        dict: Analysis scores and feedback
    """
    logger.info(f"Analyzing transcript for response: {response_id}")
    
    if not transcript or len(transcript.strip()) < 5:
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
    
    # Calculate all scores
    clarity = score_clarity(transcript)
    fluency = score_fluency(transcript)
    confidence = score_confidence(transcript)
    relevance = score_relevance(transcript)
    technical = score_technical(transcript)
    filler_count = count_filler_words(transcript)
    speech_rate = calculate_speech_rate(transcript)
    
    scores = {
        "clarityScore": clarity,
        "fluencyScore": fluency,
        "confidenceScore": confidence,
        "relevanceScore": relevance,
        "grammarScore": round((clarity + fluency) / 2, 1),
        "pronunciationScore": round(fluency * 0.9, 1),
        "technicalScore": technical,
    }
    
    # Calculate overall score (weighted average)
    overall = round(
        (clarity * 0.2 + fluency * 0.15 + confidence * 0.2 +
         relevance * 0.25 + technical * 0.2),
        1
    )
    
    feedback = generate_feedback({**scores, 'overallScore': overall}, transcript)
    
    result = {
        "responseId": response_id,
        **scores,
        "fillerWordCount": filler_count,
        "speechRateWpm": speech_rate,
        "sentiment": "positive" if overall >= 7 else "neutral",
        "overallScore": overall,
        "feedbackJson": feedback
    }
    
    logger.info(f"Analysis complete. Overall score: {overall}")
    return result