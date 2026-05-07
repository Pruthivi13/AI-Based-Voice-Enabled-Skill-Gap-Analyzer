from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import uvicorn
import asyncio
import tempfile
import os
import subprocess
import json
import uuid
from pathlib import Path
from utils.logger import setup_logger

app = FastAPI(title="AI Voice Skill Gap Analyzer - ML Service")

logger = setup_logger(__name__)

# ── Request Models ──
class EvaluateAnswerRequest(BaseModel):
    question: str
    answer: str
    reference: str

class TranscribeRequest(BaseModel):
    audioUrl: str
    responseId: str

class AnalyzeRequest(BaseModel):
    responseId: str
    transcript: Optional[str] = None

class ReportRequest(BaseModel):
    sessionId: str

class GenerateQuestionsRequest(BaseModel):
    targetRole: str
    experienceLevel: str
    interviewType: str
    questionCount: int = 5

# ✅ NEW MODEL (FOLLOW-UP)
class GenerateFollowupRequest(BaseModel):
    originalQuestion: str
    transcript: str
    targetRole: str = "Software Engineer"
    count: int = 2

# ✅ NEW MODEL
class ResumeQuestionsRequest(BaseModel):
    targetRole: str
    experienceLevel: str
    interviewType: str
    questionCount: int = 5
    resumeText: str

# ✅ NEW MODEL (ROADMAP)
class GenerateRoadmapRequest(BaseModel):
    targetRole: str
    weakSkills: list

# ✅ NEW MODEL (NODE INFO)
class NodeInfoRequest(BaseModel):
    skillLabel: str
    targetRole: str


# ✅ NEW MODEL (COURSES)
class FetchCoursesRequest(BaseModel):
    targetRole: str
    maxCourses: int = 12


# ── Health Check ──

@app.get("/")
def read_root():
    return {"message": "ML Service is running"}

@app.get("/health")
def health():
    return {"status": "ok"}


def _parse_form_list(value: Optional[str]) -> list:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        if isinstance(parsed, str):
            return [parsed]
    except Exception:
        pass
    return [item.strip() for item in value.split(",") if item.strip()]


@app.get("/api/questions")
def api_questions():
    from backend.services.question_bank import load_questions

    return {"success": True, "questions": load_questions()}


@app.post("/api/analyze-answer")
async def analyze_answer_api(
    audio: Optional[UploadFile] = File(None),
    question_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    question: Optional[str] = Form(None),
    expected_keywords: Optional[str] = Form(None),
    expected_key_points: Optional[str] = Form(None),
    reference_answer: Optional[str] = Form(None),
    duration_seconds: Optional[float] = Form(None),
    transcript: Optional[str] = Form(None),
):
    """
    Public MVP endpoint:
    audio -> STT -> keywords -> LLM content evaluation -> audio metrics -> score.
    """
    from backend.services.pipeline import analyze_answer_pipeline

    audio_path = None
    try:
        if audio is not None:
            upload_root = Path(__file__).resolve().parent / "uploads" / "analyze_answers"
            safe_user = "".join(
                ch for ch in (user_id or "anonymous") if ch.isalnum() or ch in ("-", "_")
            ) or "anonymous"
            target_dir = upload_root / safe_user
            target_dir.mkdir(parents=True, exist_ok=True)

            suffix = Path(audio.filename or "answer.webm").suffix or ".webm"
            audio_path = target_dir / f"{uuid.uuid4().hex}{suffix}"
            content = await audio.read()
            if len(content) < 100:
                raise HTTPException(status_code=400, detail="Audio file is empty or too small")
            audio_path.write_bytes(content)

        if audio_path is None and not transcript:
            raise HTTPException(
                status_code=400,
                detail="Provide an audio file or a transcript for analysis",
            )

        result = await analyze_answer_pipeline(
            audio_path=audio_path,
            transcript=transcript,
            question_id=question_id,
            user_id=user_id,
            question_text=question,
            expected_keywords=_parse_form_list(expected_keywords),
            expected_key_points=_parse_form_list(expected_key_points),
            reference_answer=reference_answer,
            duration_seconds=duration_seconds,
        )
        if audio_path:
            result["audioPath"] = str(audio_path)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analyze answer API failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Internal Endpoints ──

@app.post("/internal/transcribe")
async def transcribe(request: TranscribeRequest):
    from backend.services.transcription import transcribe_audio
    try:
        transcript = await transcribe_audio(request.audioUrl)
        return {
            "responseId": request.responseId,
            "transcript": transcript,
            "success": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/internal/analyze-response")
async def analyze_response(request: AnalyzeRequest):
    from backend.services.analyzer import analyze_transcript
    try:
        analysis = await analyze_transcript(
            request.responseId,
            request.transcript or ""
        )
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/internal/generate-report")
async def generate_report(request: ReportRequest):
    from backend.services.report import generate_session_report
    try:
        report = await generate_session_report(request.sessionId)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ EXISTING: Generate Questions
@app.post("/internal/generate-questions")
async def generate_questions_endpoint(request: GenerateQuestionsRequest):
    from backend.services.question_generator import generate_questions
    try:
        loop = asyncio.get_event_loop()

        questions = await loop.run_in_executor(
            None,
            lambda: generate_questions(
                target_role=request.targetRole,
                experience_level=request.experienceLevel,
                interview_type=request.interviewType,
                question_count=request.questionCount
            )
        )

        return {"questions": questions, "success": True}

    except Exception as e:
        logger.error(f"Generate questions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ✅ NEW: Generate Questions from Resume
@app.post("/internal/generate-questions-from-resume")
async def generate_questions_from_resume_endpoint(request: ResumeQuestionsRequest):
    from backend.services.resume_parser import generate_questions_from_resume
    try:
        loop = asyncio.get_event_loop()

        questions = await loop.run_in_executor(
            None,
            lambda: generate_questions_from_resume(
                resume_text=request.resumeText,
                target_role=request.targetRole,
                experience_level=request.experienceLevel,
                interview_type=request.interviewType,
                question_count=request.questionCount
            )
        )

        return {"questions": questions, "success": True}

    except Exception as e:
        logger.error(f"Generate questions from resume error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ✅ NEW: Generate Roadmap Endpoint
@app.post("/internal/generate-roadmap")
async def generate_roadmap_endpoint(request: GenerateRoadmapRequest):
    from backend.services.roadmap_generator import generate_roadmap
    try:
        loop = asyncio.get_event_loop()

        roadmap = await loop.run_in_executor(
            None,
            lambda: generate_roadmap(
                target_role=request.targetRole,
                weak_skills=request.weakSkills
            )
        )

        return {"roadmap": roadmap, "success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ NEW: Generate Node Info Endpoint
@app.post("/internal/generate-node-info")
async def generate_node_info_endpoint(request: NodeInfoRequest):
    from backend.services.roadmap_generator import generate_node_info
    try:
        loop = asyncio.get_event_loop()

        info = await loop.run_in_executor(
            None,
            lambda: generate_node_info(
                skill_label=request.skillLabel,
                target_role=request.targetRole
            )
        )

        return {"info": info, "success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ NEW: Generate Follow-up Questions Endpoint
@app.post("/internal/generate-followup")
async def generate_followup_endpoint(request: GenerateFollowupRequest):
    from backend.services.followup_generator import generate_followup_questions
    try:
        loop = asyncio.get_event_loop()
        followups = await loop.run_in_executor(
            None,
            lambda: generate_followup_questions(
                original_question=request.originalQuestion,
                transcript=request.transcript,
                target_role=request.targetRole,
                count=request.count,
            )
        )
        return {"followups": followups, "success": True}
    except Exception as e:
        logger.error(f"Generate follow-up error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ✅ NEW: Fetch Courses Endpoint
@app.post("/internal/fetch-courses")
async def fetch_courses_endpoint(request: FetchCoursesRequest):
    from backend.services.course_fetcher import fetch_courses
    try:
        loop = asyncio.get_event_loop()
        courses = await loop.run_in_executor(
            None,
            lambda: fetch_courses(
                target_role=request.targetRole,
                max_courses=request.maxCourses,
            )
        )
        return {"courses": courses, "success": True}
    except Exception as e:
        logger.error(f"Fetch courses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class FullAnalysisRequest(BaseModel):
    responseId: str
    transcript: str
    question: str
    expectedKeyPoints: list = []
    referenceAnswer: str = ""
    durationSeconds: float = 60.0
    wavPath: Optional[str] = None


@app.post("/internal/full-analyze")
async def full_analyze_endpoint(request: FullAnalysisRequest):
    """
    Complete pipeline using all external packages:
    1. sentence-transformers  → semantic coverage of key points
    2. librosa spectrogram    → audio delivery features
    3. Gemini/Groq LLM        → holistic content evaluation
    """
    from backend.services.semantic_scorer import (
        compute_semantic_similarity,
        compute_keypoint_coverage
    )
    from backend.services.spectrogram_analyzer import extract_audio_features
    from backend.services.gemini_evaluator import evaluate_with_gemini
    from backend.services.analyzer import count_filler_words, calculate_speech_rate

    loop = asyncio.get_event_loop()

    # Step 1 — Semantic similarity (sentence-transformers)
    semantic_coverage = await loop.run_in_executor(
        None,
        lambda: compute_keypoint_coverage(
            request.transcript,
            request.expectedKeyPoints
        )
    )

    # Step 2 — Audio delivery (librosa spectrogram)
    delivery_metrics = {}
    if request.wavPath and os.path.exists(request.wavPath):
        delivery_metrics = await loop.run_in_executor(
            None,
            lambda: extract_audio_features(request.wavPath)
        )

    # Add transcript-derived delivery metrics
    delivery_metrics["fillerWordCount"] = count_filler_words(request.transcript)
    delivery_metrics["speechRateWpm"] = calculate_speech_rate(
        request.transcript, int(request.durationSeconds)
    )

    # Step 3 — Gemini/Groq LLM evaluation (with full context)
    llm_result = await loop.run_in_executor(
        None,
        lambda: evaluate_with_gemini(
            question=request.question,
            transcript=request.transcript,
            expected_key_points=request.expectedKeyPoints,
            reference_answer=request.referenceAnswer,
            semantic_coverage=semantic_coverage,
            delivery_metrics=delivery_metrics,
        )
    )

    # Step 4 — Combine into final score
    content_score = llm_result.get("overallContentScore", 6.0)
    delivery_score = delivery_metrics.get("confidenceScore", 6.0)
    pause_score = delivery_metrics.get("pauseScore", 6.0)
    coverage_score = semantic_coverage.get("coveragePercent", 50) / 10  # normalize 0-100 → 0-10

    overall = round(
        content_score * 0.55 +      # LLM content (primary)
        coverage_score * 0.15 +     # semantic coverage
        delivery_score * 0.15 +     # voice confidence
        pause_score * 0.15,         # pause quality
        1
    )

    # Enforce final MVP score contract: content 70%, delivery 30%.
    coverage_score = semantic_coverage.get("coveragePercent", 50) / 10
    content_score = round(float(content_score) * 0.85 + coverage_score * 0.15, 1)
    delivery_score = round((float(delivery_score) + float(pause_score)) / 2, 1)
    overall = round(content_score * 0.7 + delivery_score * 0.3, 1)

    # Build feedback list
    feedback_parts = [llm_result.get("feedback", "")]
    if semantic_coverage.get("missedPoints"):
        missed = ", ".join(semantic_coverage["missedPoints"][:3])
        feedback_parts.append(f"Key points not addressed: {missed}.")
    if delivery_metrics.get("deliveryNote"):
        feedback_parts.append(delivery_metrics["deliveryNote"])

    # Compute semantic similarity for reference answer
    ref_similarity = 0.0
    if request.referenceAnswer:
        ref_similarity = await loop.run_in_executor(
            None,
            lambda: compute_semantic_similarity(
                request.transcript, request.referenceAnswer
            )
        )

    return {
        "responseId": request.responseId,
        # Content (LLM)
        "clarityScore": llm_result.get("clarity", 6.0),
        "relevanceScore": llm_result.get("relevance", 6.0),
        "technicalScore": llm_result.get("correctness", 6.0),
        # Semantic
        "completenessScore": round(coverage_score, 1),
        "coveredPoints": semantic_coverage.get("coveredPoints", []),
        "missedPoints": semantic_coverage.get("missedPoints", []),
        "semanticSimilarity": ref_similarity,
        # Delivery (spectrogram)
        "fluencyScore": delivery_metrics.get("confidenceScore", 6.0),
        "confidenceScore": delivery_metrics.get("confidenceScore", 6.0),
        "pronunciationScore": delivery_metrics.get("pitchExpressiveness", 6.0),
        "pauseScore": delivery_metrics.get("pauseScore", 6.0),
        "pauseCount": delivery_metrics.get("pauseCount", 0),
        "longPauses": delivery_metrics.get("longPauses", 0),
        "expressiveness": delivery_metrics.get("expressiveness", 5.0),
        "stammerIndicator": delivery_metrics.get("stammerIndicator", 0.0),
        # Transcript metrics
        "fillerWordCount": delivery_metrics.get("fillerWordCount", 0),
        "speechRateWpm": delivery_metrics.get("speechRateWpm", 0),
        # Combined
        "contentScore": content_score,
        "deliveryScore": delivery_score,
        "overallScore": overall,
        "grammarScore": round((llm_result.get("clarity", 6.0) + delivery_metrics.get("confidenceScore", 6.0)) / 2, 1),
        "sentiment": "positive" if overall >= 7 else "neutral",
        "feedbackJson": feedback_parts,
        "keywordsFound": llm_result.get("keywordsFound", []),
        "strengths": llm_result.get("strengths", []),
        "improvements": llm_result.get("improvements", []),
        "success": True,
    }


@app.post("/internal/evaluate-answer")
async def evaluate_answer_endpoint(request: EvaluateAnswerRequest):
    from backend.services.content_scorer import evaluate_answer
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: evaluate_answer(
                question=request.question,
                answer=request.answer,
                reference=request.reference,
            )
        )
        return {**result, "success": True}
    except Exception as e:
        logger.error(f"Evaluate answer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))    


# ── WebSocket Transcription ──
@app.websocket("/ws/transcribe/{response_id}")
async def websocket_transcribe(websocket: WebSocket, response_id: str):
    await websocket.accept()
    logger_ws = setup_logger("websocket")
    logger_ws.info(f"WebSocket connected for response: {response_id}")

    audio_chunks = []
    chunk_count = 0

    try:
        while True:
            # Accept both text and binary frames
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                logger_ws.info("WebSocket disconnected by client")
                break

            # Check for END signal in both text and binary forms
            text_data = message.get("text")
            bytes_data = message.get("bytes")

            if text_data == "END" or bytes_data == b"END":
                logger_ws.info("Received END signal — running final transcription")
                break

            if bytes_data and len(bytes_data) > 0:
                audio_chunks.append(bytes_data)
                chunk_count += 1

                if chunk_count % 5 == 0:
                    try:
                        partial_text = await run_transcription(audio_chunks, partial=True)
                        if partial_text:
                            await websocket.send_text(json.dumps({
                                "type": "partial",
                                "text": partial_text
                            }))
                    except Exception as e:
                        logger_ws.error(f"Partial transcription error: {e}")

        if audio_chunks:
            final_text = await run_transcription(audio_chunks, partial=False)
            await websocket.send_text(json.dumps({
                "type": "final",
                "text": final_text,
                "responseId": response_id
            }))
        else:
            await websocket.send_text(json.dumps({
                "type": "final",
                "text": "No audio received",
                "responseId": response_id
            }))

    except WebSocketDisconnect:
        logger_ws.info(f"WebSocket disconnected for response: {response_id}")
        # Still try to send final transcription if we have audio
        # (client disconnected before we could send it)
    except Exception as e:
        logger_ws.error(f"WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except:
            pass
    finally:
        logger_ws.info(f"WebSocket closed for response: {response_id}")


async def run_transcription(chunks: list, partial: bool = False) -> str:
    audio_data = b"".join(chunks)

    if len(audio_data) < 500:
        return ""

    tmp_path = None
    wav_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        wav_path = tmp_path.replace(".webm", ".wav")

        result = subprocess.run(
            ["ffmpeg", "-i", tmp_path, "-ar", "16000", "-ac", "1", "-y", wav_path],
            capture_output=True,
            text=True,
            timeout=30
        )

        if not os.path.exists(wav_path) or os.path.getsize(wav_path) < 100:
            logger.error(f"ffmpeg failed to create valid wav. stderr: {result.stderr[:500]}")
            return ""

        loop = asyncio.get_event_loop()
        transcript = await loop.run_in_executor(
            None,
            lambda: _transcribe_sync(wav_path, partial)
        )

        return transcript

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return ""
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


def _transcribe_sync(wav_path: str, partial: bool) -> str:
    from backend.services.transcription import get_model

    model = get_model()
    segments, _ = model.transcribe(
        wav_path,
        beam_size=1 if partial else 3,
        language="en",
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )
    return " ".join(s.text.strip() for s in segments)


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
