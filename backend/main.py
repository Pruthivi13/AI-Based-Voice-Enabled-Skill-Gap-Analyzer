from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn

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

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)