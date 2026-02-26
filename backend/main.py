from fastapi import FastAPI
from backend.services.orchestrator import PipelineOrchestrator
from core.config import Config

app = FastAPI(title="AI Voice Skill Gap Analyzer API")

# Initialize configuration and orchestrator
config = Config()
orchestrator = PipelineOrchestrator(config)

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Voice Skill Gap Analyzer API"}

@app.post("/analyze")
def analyze_audio(audio_data: dict): # placeholder
    result = orchestrator.run_pipeline(audio_data)
    return result
