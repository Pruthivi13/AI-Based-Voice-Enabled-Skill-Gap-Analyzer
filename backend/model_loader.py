from core.config import Config
from utils.logger import setup_logger
import os

logger = setup_logger(__name__)

class ModelLoader:
    def __init__(self, config: Config):
        self.config = config
        self.models_dir = config.MODELS_DIR
        
    def load_whisper(self):
        logger.info(f"Loading Whisper model {self.config.WHISPER_MODEL_SIZE} from {self.models_dir}")
        # placeholder for whisper load
        return None

    def load_sentence_transformer(self):
        logger.info(f"Loading Sentence Transformer {self.config.EMBEDDING_MODEL_NAME} from {self.models_dir}")
        # placeholder for transformer load
        return None
