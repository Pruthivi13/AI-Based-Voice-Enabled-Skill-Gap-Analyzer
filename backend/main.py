from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import uvicorn
import asyncio
import tempfile
import os
import subprocess
import json
from utils.logger import setup_logger

app = FastAPI(title="AI Voice Skill Gap Analyzer - ML Service")

logger = setup_logger(__name__)

# ── Request Models ──

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

# ✅ NEW MODEL
class ResumeQuestionsRequest(BaseModel):
    targetRole: str
    experienceLevel: str
    interviewType: str
    questionCount: int = 5
    resumeText: str


# ── Health Check ──

@app.get("/")
def read_root():
    return {"message": "ML Service is running"}

@app.get("/health")
def health():
    return {"status": "ok"}


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
            data = await websocket.receive_bytes()

            if data == b"END":
                logger_ws.info("Received END signal — running final transcription")
                break

            audio_chunks.append(data)
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
    except Exception as e:
        logger_ws.error(f"WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except:
            pass
    except BaseException as be:
        logger_ws.error(f"WebSocket BaseException (like CancelledError): {repr(be)}")
        raise
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
