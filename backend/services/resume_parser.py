import json
import os
from dotenv import load_dotenv
from groq import Groq
from utils.logger import setup_logger

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../backend/.env'))

logger = setup_logger(__name__)

api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key)

def generate_questions_from_resume(
    resume_text: str,
    target_role: str,
    experience_level: str,
    interview_type: str,
    question_count: int = 5
) -> list:
    logger.info(f"Generating resume-tailored questions for {target_role}")

    prompt = f"""
You are an expert interviewer. You have been given a candidate's resume and must generate highly personalized interview questions based on their actual experience.

Target Role: {target_role}
Experience Level: {experience_level}
Interview Type: {interview_type}

Candidate Resume:
{resume_text[:3000]}

Rules:
- Reference specific projects, technologies, or experiences from their resume
- Ask about gaps, transitions, or interesting points in their background
- For TECHNICAL: ask about specific technologies they listed
- For HR: ask about specific roles and responsibilities they mentioned
- For MIXED: combine both
- Make questions feel like a real interviewer who READ their resume
- Generate exactly {question_count} questions

Return ONLY a valid JSON array, no explanation, no markdown:
[
  {{
    "content": "question text here referencing their resume",
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
                    "content": "You are an expert interviewer who generates personalized questions based on candidate resumes. Always return valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=1500,
        )

        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        questions = json.loads(raw)

        cleaned = []
        for i, q in enumerate(questions):
            cleaned.append({
                "id": f"resume_{i}_{abs(hash(q.get('content', '')))}",
                "content": q.get("content", ""),
                "category": q.get("category", "TECHNICAL"),
                "difficulty": q.get("difficulty", "MEDIUM"),
                "timeLimitSeconds": q.get("timeLimitSeconds", 120),
                "role": target_role,
                "source": "resume"
            })

        logger.info(f"Generated {len(cleaned)} resume-tailored questions")
        return cleaned

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Groq response: {e}")
        raise Exception("Failed to parse questions from Groq")
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        raise