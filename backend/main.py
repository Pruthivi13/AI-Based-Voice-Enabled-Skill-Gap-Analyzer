from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
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

# ── Request Models ──

class TranscribeRequest(BaseModel):
    audioUrl: str
    responseId: str

class AnalyzeRequest(BaseModel):
    responseId: str
    transcript: Optional[str] = None

class ReportRequest(BaseModel):
    sessionId: str

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

# ── WebSocket Transcription ──

@app.websocket("/ws/transcribe/{response_id}")
async def websocket_transcribe(websocket: WebSocket, response_id: str):
    await websocket.accept()
    logger = setup_logger("websocket")
    logger.info(f"WebSocket connected for response: {response_id}")

    audio_chunks = []
    chunk_count = 0

    try:
        while True:
            # Receive data from frontend
            data = await websocket.receive_bytes()

            # Frontend sends "END" string as bytes when recording stops
            if data == b"END":
                logger.info("Received END signal — running final transcription")
                break

            audio_chunks.append(data)
            chunk_count += 1

            # Run partial transcription every 5 chunks (~1 second of audio)
            if chunk_count % 5 == 0:
                try:
                    partial_text = await run_transcription(audio_chunks, partial=True)
                    if partial_text:
                        await websocket.send_text(json.dumps({
                            "type": "partial",
                            "text": partial_text
                        }))
                        logger.info(f"Sent partial transcript: {partial_text[:60]}")
                except Exception as e:
                    logger.error(f"Partial transcription error: {e}")
                    # Don't break — keep collecting chunks

        # Final transcription on complete audio
        if audio_chunks:
            final_text = await run_transcription(audio_chunks, partial=False)
            await websocket.send_text(json.dumps({
                "type": "final",
                "text": final_text,
                "responseId": response_id
            }))
            logger.info(f"Sent final transcript: {final_text[:100]}")
        else:
            await websocket.send_text(json.dumps({
                "type": "final",
                "text": "No audio received",
                "responseId": response_id
            }))

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for response: {response_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except:
            pass
    finally:
        logger.info(f"WebSocket closed for response: {response_id}")


async def run_transcription(chunks: list, partial: bool = False) -> str:
    """
    Combines audio chunks, converts to WAV, runs faster-whisper.
    partial=True uses beam_size=1 for speed.
    partial=False uses beam_size=3 for better final accuracy.
    """
    # Combine all chunks into one buffer
    audio_data = b"".join(chunks)

    if len(audio_data) < 500:
        return ""

    tmp_path = None
    wav_path = None

    try:
        # Save combined audio
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        wav_path = tmp_path.replace(".webm", ".wav")

        # Convert to WAV
        result = subprocess.run(
            ["ffmpeg", "-i", tmp_path, "-ar", "16000", "-ac", "1", "-y", wav_path],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0 or not os.path.exists(wav_path):
            return ""

        # Run transcription in thread pool so it doesn't block the event loop
        loop = asyncio.get_event_loop()
        transcript = await loop.run_in_executor(
            None,
            lambda: _transcribe_sync(wav_path, partial)
        )

        return transcript

    except Exception as e:
        return ""
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


def _transcribe_sync(wav_path: str, partial: bool) -> str:
    """Runs in a thread pool — faster-whisper is not async."""
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