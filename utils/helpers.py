"""
General utility functions shared across various modules.
"""
from utils.logger import setup_logger

logger = setup_logger(__name__)

def clean_text(text: str) -> str:
    """
    Normalizes transcript text before NLP processing.
    
    Args:
        text: Raw text string
        
    Returns:
        str: Lowercased, stripped, and punctuation-free string.
    """
    # TODO: Implement basic string cleanup regex
    return text.strip().lower()

def load_json(filepath: str) -> dict:
    """Safely loads and returns JSON data."""
    # TODO: JSON file loading logic
    return {}
