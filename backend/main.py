from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Query
from pydantic import BaseModel
from typing import Any, Optional, cast
import uvicorn
import asyncio
import tempfile
import os
import subprocess
import json
import uuid
import random
import numpy as np
import torch
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from utils.logger import setup_logger

app = FastAPI(title="AI Voice Skill Gap Analyzer - ML Service")

logger = setup_logger(__name__)

TRANSCRIPTION_FAILED_SENTINEL = "__TRANSCRIPTION_FAILED__"


@app.on_event("startup")
async def preload_models():
    """Pre-load heavy models so the first real request is less likely to stall."""
    loop = asyncio.get_running_loop()

    try:
        from backend.services.stt_service import _get_whisper_model

        await loop.run_in_executor(None, _get_whisper_model)
        logger.info("Whisper model pre-loaded.")
    except Exception as error:
        logger.warning("Whisper pre-load failed: %s", error)

    try:
        from backend.services.content_scorer import get_sentence_transformer

        await loop.run_in_executor(None, get_sentence_transformer)
        logger.info("SentenceTransformer pre-loaded.")
    except Exception as error:
        logger.warning("SentenceTransformer pre-load failed: %s", error)

    try:
        from backend.services.content_scorer import _check_model_available

        _check_model_available()
    except Exception:
        pass

torch.manual_seed(42)
np.random.seed(42)
random.seed(42)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(42)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = PROJECT_ROOT / "backend" / "uploads" / "audio"

# ── Request Models ──
class EvaluateAnswerRequest(BaseModel):
    question: str
    answer: str
    reference: str
    expectedKeywords: Optional[list[str]] = None
    expectedKeyPoints: Optional[list[str]] = None

class TranscribeRequest(BaseModel):
    audioUrl: str
    responseId: str

class AnalyzeRequest(BaseModel):
    responseId: str
    transcript: Optional[str] = None
    questionText: Optional[str] = None
    audioUrl: Optional[str] = None
    expectedKeywords: Optional[list[str]] = None
    expectedKeyPoints: Optional[list[str]] = None
    idealAnswer: Optional[str] = None

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


# ── AI Interview Evaluator MVP Endpoints ──

async def _save_upload_file(file: UploadFile) -> str:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg"}:
        suffix = ".webm"
    destination = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
    contents = await file.read()
    if len(contents) < 1:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty")
    destination.write_bytes(contents)
    return str(destination)


def _download_audio_url(audio_url: str) -> str:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    parsed_path = Path(urlparse(audio_url).path)
    suffix = parsed_path.suffix.lower()
    if suffix not in {".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg"}:
        suffix = ".webm"
    destination = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"

    request = Request(audio_url, headers={"User-Agent": "AI-Interview-Evaluator/1.0"})
    with urlopen(request, timeout=45) as response:
        contents = response.read()
    if len(contents) < 1:
        raise HTTPException(status_code=400, detail="Downloaded audio file is empty")
    destination.write_bytes(contents)
    return str(destination)


def _build_dynamic_question(
    question_id: str,
    question_text: str,
    expected_keywords: list[str],
    expected_key_points: list[str],
    ideal_answer: str,
) -> dict:
    return {
        "id": question_id,
        "question_text": question_text,
        "content": question_text,
        "topic": "Dynamic",
        "category": "TECHNICAL",
        "difficulty": "MEDIUM",
        "expected_keywords": expected_keywords,
        "expected_key_points": expected_key_points,
        "ideal_answer": ideal_answer,
    }


@app.get("/api/questions")
def get_evaluator_questions():
    from backend.services.question_bank import list_questions

    return {"success": True, "questions": list_questions()}


@app.post("/api/upload-audio")
async def upload_evaluator_audio(
    audio: UploadFile = File(...),
    question_id: str = Form(...),
    user_id: str = Form("anonymous"),
):
    audio_path = await _save_upload_file(audio)
    return {
        "success": True,
        "upload_id": str(uuid.uuid4()),
        "user_id": user_id,
        "question_id": question_id,
        "audio_path": audio_path,
    }


@app.post("/api/analyze-answer")
async def analyze_answer_pipeline(
    audio: Optional[UploadFile] = File(None),
    audio_url: Optional[str] = Form(None),
    question_id: str = Form(...),
    user_id: str = Form("anonymous"),
    response_id: Optional[str] = Form(None),
    transcript: Optional[str] = Form(None),
    question_text: Optional[str] = Form(None),
    expected_keywords: Optional[list[str]] = Form(None),
    expected_key_points: Optional[list[str]] = Form(None),
    ideal_answer: Optional[str] = Form(None),
):
    from backend.services.audio_analysis import analyze_audio
    from backend.services.content_scorer import evaluate_answer as evaluate_content_model
    from backend.services.keyword_extractor import extract_keywords
    from backend.services.llm_service import evaluate_content
    from backend.services.question_bank import get_question
    from backend.services.scoring import build_final_result
    from backend.services.stt_service import transcribe_file

    question = get_question(question_id)
    override_keywords = expected_keywords or []
    override_key_points = expected_key_points or []

    if question is None:
        if not question_text:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Question not found. Provide a valid question_id or include "
                    "question_text with expected_keywords/expected_key_points."
                ),
            )
        question = _build_dynamic_question(
            question_id=question_id,
            question_text=question_text,
            expected_keywords=override_keywords,
            expected_key_points=override_key_points,
            ideal_answer=ideal_answer or "",
        )
    else:
        if override_keywords:
            question["expected_keywords"] = override_keywords
        if override_key_points:
            question["expected_key_points"] = override_key_points
        if ideal_answer:
            question["ideal_answer"] = ideal_answer

    loop = asyncio.get_event_loop()

    audio_path = await _save_upload_file(audio) if audio else None
    if not audio_path and audio_url:
        try:
            audio_path = await loop.run_in_executor(
                None,
                lambda: _download_audio_url(audio_url),
            )
        except HTTPException:
            raise
        except Exception as error:
            logger.error(f"Analyze-answer audio download error: {error}")
            raise HTTPException(status_code=400, detail=f"Could not download audio_url: {error}")

    if not audio_path and not (transcript and transcript.strip()):
        raise HTTPException(
            status_code=400,
            detail="Provide an audio file, audio_url, or transcript field.",
        )

    if audio_path:
        try:
            stt_result = await loop.run_in_executor(
                None,
                lambda: transcribe_file(audio_path),
            )
        except Exception as error:
            if transcript and transcript.strip():
                logger.warning(
                    "Audio transcription failed; using provided transcript: %s",
                    error,
                )
                stt_result = {
                    "transcript": transcript.strip(),
                    "provider": "provided_transcript_after_stt_error",
                    "model": None,
                    "segments": [],
                    "words": [],
                    "stt_error": str(error),
                }
            else:
                logger.error(f"Analyze-answer transcription error: {error}")
                raise HTTPException(status_code=500, detail=str(error))
    else:
        stt_result = {
            "transcript": (transcript or "").strip(),
            "provider": "provided_transcript",
            "model": None,
            "segments": [],
            "words": [],
        }

    transcript_text = str(stt_result.get("transcript", "") or "").strip()
    if not transcript_text:
        transcript_text = "No speech detected"

    keyword_result = await loop.run_in_executor(
        None,
        lambda: extract_keywords(
            transcript_text,
            question.get("expected_keywords", []),
            question.get("expected_key_points", []),
        ),
    )
    stt_segments = cast(list[dict[str, Any]], stt_result.get("segments") or [])
    audio_metrics = await loop.run_in_executor(
        None,
        lambda: analyze_audio(
            audio_path,
            transcript_text,
            stt_segments,
        ),
    )
    llm_result = await loop.run_in_executor(
        None,
        lambda: evaluate_content(
            question_text=question.get("question_text") or question.get("content") or "",
            transcript=transcript_text,
            expected_keywords=question.get("expected_keywords", []),
            expected_key_points=question.get("expected_key_points", []),
            ideal_answer=question.get("ideal_answer", ""),
            keyword_result=keyword_result,
        ),
    )
    try:
        content_model_result = await loop.run_in_executor(
            None,
            lambda: evaluate_content_model(
                question=question.get("question_text") or question.get("content") or "",
                answer=transcript_text,
                reference=question.get("ideal_answer", ""),
                expected_keywords=question.get("expected_keywords", []),
                expected_key_points=question.get("expected_key_points", []),
            ),
        )
    except Exception as error:
        logger.warning("Content scorer failed; continuing with LLM rubric only: %s", error)
        content_model_result = {
            "model_label": "ERROR",
            "scorer_backend": "error",
            "keyword_overlap": 0.0,
            "answer_length": len(transcript_text.split()),
            "final_score": "WEAK",
            "content_score": 4.0,
            "feedback": "The content scorer could not run for this response.",
            "model_error": str(error),
        }
    final_result = build_final_result(
        question=question,
        transcript=transcript_text,
        keyword_result=keyword_result,
        llm_result=llm_result,
        audio_metrics=audio_metrics,
        content_model_result=content_model_result,
    )

    return {
        "success": True,
        "response_id": response_id or str(uuid.uuid4()),
        "user_id": user_id,
        "stt": stt_result,
        **final_result,
    }


@app.get("/api/results/{user_id}")
def get_evaluator_results(
    user_id: str,
    limit: int = Query(50, ge=1, le=200),
):
    from backend.services.storage_service import list_results_for_user

    return {
        "success": True,
        "user_id": user_id,
        "results": list_results_for_user(user_id=user_id, limit=limit),
    }


# ── Internal Endpoints ──

@app.post("/internal/transcribe")
async def transcribe(request: TranscribeRequest):
    from backend.services.stt_service import transcribe_file
    try:
        loop = asyncio.get_event_loop()
        audio_path = await loop.run_in_executor(
            None,
            lambda: _download_audio_url(request.audioUrl),
        )
        try:
            result = await loop.run_in_executor(
                None,
                lambda: transcribe_file(audio_path),
            )
        finally:
            if os.path.exists(audio_path):
                os.unlink(audio_path)

        return {
            "responseId": request.responseId,
            "transcript": result.get("transcript", ""),
            "stt": result,
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
            request.transcript or "",
            question_text=request.questionText,
            audio_url=request.audioUrl,
            expected_keywords=request.expectedKeywords or [],
            expected_key_points=request.expectedKeyPoints or [],
            ideal_answer=request.idealAnswer or "",
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
                expected_keywords=request.expectedKeywords or [],
                expected_key_points=request.expectedKeyPoints or [],
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
                    except RuntimeError as e:
                        if "close message has been sent" in str(e):
                            logger_ws.info("WebSocket closed during partial transcription")
                            break
                        logger_ws.error(f"Partial transcription error: {e}")
                    except Exception as e:
                        logger_ws.error(f"Partial transcription error: {e}")

        if audio_chunks:
            final_text = await run_transcription(audio_chunks, partial=False)
            try:
                if final_text == TRANSCRIPTION_FAILED_SENTINEL:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Transcription failed. Please try recording again.",
                        "responseId": response_id
                    }))
                    return

                await websocket.send_text(json.dumps({
                    "type": "final",
                    "text": final_text,
                    "responseId": response_id
                }))
            except RuntimeError as e:
                if "close message has been sent" in str(e):
                    logger_ws.info("WebSocket closed before final transcription could be sent")
                else:
                    logger_ws.error(f"WebSocket send error: {e}")
        else:
            try:
                await websocket.send_text(json.dumps({
                    "type": "final",
                    "text": "No audio received",
                    "responseId": response_id
                }))
            except RuntimeError:
                pass

    except WebSocketDisconnect:
        logger_ws.info(f"WebSocket disconnected for response: {response_id}")
        # Client disconnected, nothing more to send
    except RuntimeError as e:
        if "close message has been sent" in str(e):
            logger_ws.info(f"WebSocket closed by client: {e}")
        else:
            logger_ws.error(f"WebSocket error: {e}")
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
            return "" if partial else TRANSCRIPTION_FAILED_SENTINEL

        loop = asyncio.get_event_loop()
        transcript = await loop.run_in_executor(
            None,
            lambda: _transcribe_sync(wav_path, partial)
        )

        return transcript

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return "" if partial else TRANSCRIPTION_FAILED_SENTINEL
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


def _transcribe_sync(wav_path: str, partial: bool) -> str:
    from backend.services.stt_service import _get_whisper_model

    model = _get_whisper_model()
    segments, _ = model.transcribe(
        wav_path,
        beam_size=1 if partial else 3,
        language="en",
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )
    return " ".join(s.text.strip() for s in segments)


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000)
