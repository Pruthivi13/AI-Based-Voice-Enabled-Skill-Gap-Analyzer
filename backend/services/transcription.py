import whisper
import tempfile
import os
import httpx
import subprocess
from utils.logger import setup_logger

logger = setup_logger(__name__)

model = None

def get_model():
    global model
    if model is None:
        logger.info("Loading Whisper model...")
        model = whisper.load_model("base")
        logger.info("Whisper model loaded!")
    return model

async def transcribe_audio(audio_url: str) -> str:
    logger.info(f"Transcribing audio from: {audio_url}")

    # Download audio file
    async with httpx.AsyncClient() as client:
        response = await client.get(audio_url, timeout=30.0)
        logger.info(f"Download status: {response.status_code}, size: {len(response.content)} bytes")
        if response.status_code != 200:
            raise Exception(f"Failed to download audio: {response.status_code}")
        audio_data = response.content

    if len(audio_data) < 100:
        raise Exception(f"Audio file too small: {len(audio_data)} bytes")

    # Save original webm file
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name

    logger.info(f"Saved to temp file: {tmp_path}")

    # Convert webm to wav using ffmpeg
    wav_path = tmp_path.replace('.webm', '.wav')

    try:
        logger.info("Converting webm to wav...")
        result = subprocess.run(
            ['ffmpeg', '-i', tmp_path, '-ar', '16000', '-ac', '1', '-y', wav_path],
            capture_output=True,
            text=True,
            timeout=30
        )

        logger.info(f"ffmpeg return code: {result.returncode}")
        if result.stderr:
            logger.info(f"ffmpeg stderr: {result.stderr[-500:]}")

        if result.returncode != 0:
            raise Exception(f"ffmpeg conversion failed with code {result.returncode}: {result.stderr[-200:]}")

        if not os.path.exists(wav_path) or os.path.getsize(wav_path) < 100:
            raise Exception(f"WAV file not created or too small")

        logger.info(f"WAV file size: {os.path.getsize(wav_path)} bytes")
        logger.info("Running Whisper...")

        whisper_model = get_model()
        whisper_result = whisper_model.transcribe(wav_path)
        transcript = whisper_result["text"].strip()

        logger.info(f"Transcription complete: {transcript[:100]}")
        return transcript if transcript else "No speech detected"

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if os.path.exists(wav_path):
            os.unlink(wav_path)