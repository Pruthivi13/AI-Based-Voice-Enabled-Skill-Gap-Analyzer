"""
A model wrapper handling the interaction with an ongoing mock-interview.
"""
from utils.logger import setup_logger

logger = setup_logger(__name__)

class InterviewSession:
    """Stores history of questions asked, responses, and orchestrates user interaction state."""
    def __init__(self, session_id: str):
        self.session_id = session_id
        # TODO: Setup data store structure 
        logger.info(f"Initialized new Interview Session: {session_id}")

    def load_question(self, index: int) -> dict:
        """
        Retrieves the next question from data module.
        
        Args:
            index: ID of the question to ask next.
            
        Returns:
            dict: The question text, category, and reference answer context.
        """
        # TODO: Load from question bank
        return {"id": index, "content": "What is Object-Oriented Programming?"}

    def record_answer(self, transcript: str):
        """Append user submission to current state"""
        # TODO: Store results
        pass
