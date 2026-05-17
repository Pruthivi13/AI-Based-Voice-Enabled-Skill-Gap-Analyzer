import json
import os
import re
from dotenv import load_dotenv
from groq import Groq
from utils.logger import setup_logger

# Load env with explicit path
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))

logger = setup_logger(__name__)


def generate_questions(
    target_role: str,
    experience_level: str,
    interview_type: str,
    question_count: int = 5
) -> list:
    logger.info(f"Generating {question_count} questions for {target_role} ({experience_level})")

    import random as _random
    _variation_seed = _random.randint(1, 1000)

    prompt = f"""
You are an expert interviewer. Generate exactly {question_count} UNIQUE and VARIED interview questions for:

Role: {target_role}
Experience Level: {experience_level}
Interview Type: {interview_type}
Variation seed (use this to ensure different questions each time): {_variation_seed}

Rules:
- Questions must be VERY specific to the {target_role} role
- NEVER repeat common questions like "difference between var, let, const" or "what is virtual DOM"
- Cover DIFFERENT topics each time — avoid the most obvious/common questions
- Be creative, pick niche but relevant topics for the role
- Match difficulty to {experience_level} level
- For TECHNICAL: focus on skills, tools, concepts specific to {target_role}
- For HR: behavioral and situational questions relevant to {target_role}
- For COMMUNICATION: collaboration and stakeholder questions for {target_role}
- For MIXED: mix of technical and behavioral for {target_role}
- Topics to AVOID (too common, overused):
  * "difference between var let const"
  * "what is virtual DOM"
  * "explain REST API"
  * "what is polymorphism"
  * "tell me about yourself"
  * Any question that appears in every interview guide

For EACH question, provide 2-3 helpful hints that guide the candidate:
- For BEHAVIORAL questions: suggest using STAR method, specific frameworks
- For TECHNICAL questions: mention key concepts, common pitfalls, relevant technologies
- Keep hints concise (1 sentence each)

Return ONLY a valid JSON array:
[
  {{
    "content": "question text here",
    "category": "TECHNICAL or HR or COMMUNICATION",
    "difficulty": "EASY or MEDIUM or HARD",
    "timeLimitSeconds": 120,
    "hints": [
      "First helpful hint here",
      "Second helpful hint here"
    ],
    "expectedKeywords": ["keyword1", "keyword2", "keyword3"],
    "referenceAnswer": "A concise ideal answer covering the main points."
  }}
]
"""

    import time
    models = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "gemma2-9b-it",
    ]

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not found in environment")
    client = Groq(api_key=api_key)

    raw = ""
    try:
        last_error = None
        for model_name in models:
            for attempt in range(3):  # retry each model up to 3 times
                try:
                    logger.info(f"Trying model: {model_name}, attempt {attempt + 1}")
                    import random
                    response = client.chat.completions.create(
                        model=model_name,
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
                        temperature=0.8,
                        seed=random.randint(1, 99999),
                        max_tokens=1800,
                    )
                    raw = (response.choices[0].message.content or "").strip()
                    logger.info(f"Success with model: {model_name}")
                    break  # success, exit retry loop
                except Exception as model_err:
                    last_error = model_err
                    err_str = str(model_err)
                    if "429" in err_str:
                        wait = 2 ** attempt * 3  # 3s, 6s, 12s
                        logger.warning(f"Rate limited on {model_name}, waiting {wait}s...")
                        time.sleep(wait)
                    else:
                        logger.warning(f"Model {model_name} failed: {model_err}")
                        break  # non-rate-limit error, try next model
            if raw:
                break  # got a response, stop trying models

        if not raw:
            raise last_error or Exception("All models failed to generate questions")

        # Extract JSON safely (handles garbage text)
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            raw = match.group(0)

        questions = json.loads(raw)

        # Normalize output
        cleaned = []
        for i, q in enumerate(questions):
            cleaned.append({
                "id": f"groq_{i}_{abs(hash(q.get('content', '')))}",
                "content": q.get("content", ""),
                "category": q.get("category", "TECHNICAL"),
                "difficulty": q.get("difficulty", "MEDIUM"),
                "timeLimitSeconds": q.get("timeLimitSeconds", 120),
                "hints": q.get("hints", []),
                "expectedKeywords": q.get("expectedKeywords", []),
                "referenceAnswer": q.get("referenceAnswer", ""),
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
