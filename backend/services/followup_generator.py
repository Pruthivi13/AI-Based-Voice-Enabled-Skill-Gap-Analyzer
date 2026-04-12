"""
followup_generator.py — Generates contextual follow-up questions from a transcript.
"""
import json
import os
import re
from dotenv import load_dotenv
from groq import Groq
from utils.logger import setup_logger

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../backend/.env'))

logger = setup_logger(__name__)

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY not found in environment")

client = Groq(api_key=api_key)


def generate_followup_questions(
    original_question: str,
    transcript: str,
    target_role: str = "Software Engineer",
    count: int = 2,
) -> list[dict]:
    """
    Generate follow-up questions based on what the candidate said.

    Args:
        original_question: The interview question that was asked
        transcript:        The candidate's spoken answer (transcribed)
        target_role:       The job role being interviewed for
        count:             Number of follow-up questions to generate (1 or 2)

    Returns:
        List of dicts: [{ "id": str, "question": str, "reason": str, "topic": str }]
    """
    logger.info(f"Generating {count} follow-up(s) for role: {target_role}")

    if not transcript or len(transcript.strip()) < 10:
        logger.warning("Transcript too short — returning empty follow-ups")
        return []

    prompt = f"""You are an expert interviewer conducting an interview for a "{target_role}" position.

The candidate was asked:
"{original_question}"

The candidate responded:
"{transcript[:1500]}"

Analyze their answer and generate exactly {count} targeted follow-up question(s).

Rules:
- Each follow-up must directly reference something specific the candidate mentioned
- Quote or paraphrase their exact words in the question (e.g. "You mentioned X — can you explain...")
- Probe for depth: ask them to elaborate, give examples, or clarify vague points
- Be conversational and natural, as a real interviewer would ask
- Focus on technical concepts, specific tools, or claims they made
- Do NOT ask generic questions unrelated to their answer

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {{
    "question": "You mentioned X — can you walk me through how that works in practice?",
    "reason": "Candidate used X but didn't explain the mechanism",
    "topic": "X"
  }}
]
"""

    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"]
    raw = ""

    for model_name in models:
        try:
            logger.info(f"Trying model: {model_name}")
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert interviewer. Generate targeted follow-up questions. Return ONLY valid JSON array.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=600,
            )
            raw = response.choices[0].message.content.strip()
            logger.info(f"Success with model: {model_name}")
            break
        except Exception as err:
            logger.warning(f"Model {model_name} failed: {err}")
            continue

    if not raw:
        logger.error("All models failed for follow-up generation")
        return []

    try:
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            raw = match.group(0)

        followups = json.loads(raw)

        cleaned = []
        for i, fq in enumerate(followups[:count]):
            cleaned.append({
                "id": f"followup_{i}",
                "question": str(fq.get("question", "")).strip(),
                "reason": str(fq.get("reason", "")).strip(),
                "topic": str(fq.get("topic", "")).strip(),
            })

        logger.info(f"Generated {len(cleaned)} follow-up question(s)")
        return cleaned

    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"Failed to parse follow-up response: {e}\nRaw: {raw[:300]}")
        return []
