import json
import os
import re
from dotenv import load_dotenv
from groq import Groq
from utils.logger import setup_logger

# Load env
load_dotenv()

logger = setup_logger(__name__)

# Init client
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY not found in environment")

client = Groq(api_key=api_key)


def generate_questions(
    target_role: str,
    experience_level: str,
    interview_type: str,
    question_count: int = 5
) -> list:
    logger.info(f"Generating {question_count} questions for {target_role} ({experience_level})")

    prompt = f"""
You are an expert interviewer. Generate exactly {question_count} interview questions for:

Role: {target_role}
Experience Level: {experience_level}
Interview Type: {interview_type}

Rules:
- Questions must be VERY specific to the {target_role} role
- Match difficulty to {experience_level} level
- For TECHNICAL: focus on skills, tools, concepts specific to {target_role}
- For HR: behavioral and situational questions relevant to {target_role}
- For COMMUNICATION: collaboration and stakeholder questions for {target_role}
- For MIXED: mix of technical and behavioral for {target_role}

Return ONLY a valid JSON array:
[
  {{
    "content": "question text here",
    "category": "TECHNICAL or HR or COMMUNICATION",
    "difficulty": "EASY or MEDIUM or HARD",
    "timeLimitSeconds": 120
  }}
]
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert interviewer. Return only valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,  # more stable JSON
            max_tokens=1000,
        )

        raw = response.choices[0].message.content.strip()

        # 🔧 Extract JSON safely (handles garbage text)
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            raw = match.group(0)

        questions = json.loads(raw)

        # ✅ Normalize output
        cleaned = []
        for i, q in enumerate(questions):
            cleaned.append({
                "id": f"groq_{i}_{abs(hash(q.get('content', '')))}",
                "content": q.get("content", ""),
                "category": q.get("category", "TECHNICAL"),
                "difficulty": q.get("difficulty", "MEDIUM"),
                "timeLimitSeconds": q.get("timeLimitSeconds", 120),
                "role": target_role,
            })

        logger.info(f"Generated {len(cleaned)} questions successfully")
        return cleaned

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        logger.error(f"Raw response: {raw}")
        raise Exception("Failed to parse questions from Groq")

    except Exception as e:
        logger.error(f"Groq API error: {e}")
        raise