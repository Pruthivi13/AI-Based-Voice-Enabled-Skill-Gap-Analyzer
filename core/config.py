"""
Defines the base configuration for the application.
Retrieves settings from environment variables or uses sensible defaults.
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base Configuration class for AI Voice Skill Gap Analyzer."""
    
    # Project Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    MODELS_DIR: str = os.path.join(BASE_DIR, "models")
    
    # ML Models Configuration
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
    
    # Audio Settings
    SAMPLE_RATE: int = int(os.getenv("SAMPLE_RATE", 16000))
    CHANNELS: int = int(os.getenv("CHANNELS", 1))

    # App Settings
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
