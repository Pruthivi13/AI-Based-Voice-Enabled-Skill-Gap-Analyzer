"""
Report generator — aggregates session analyses into a final report.
"""
from utils.logger import setup_logger

logger = setup_logger(__name__)

def get_rating_label(score: float) -> str:
    if score >= 9:
        return "Excellent"
    elif score >= 7:
        return "Good"
    elif score >= 5:
        return "Average"
    return "Needs Improvement"

def calculate_average(values: list) -> float:
    valid = [v for v in values if v is not None]
    if not valid:
        return 0.0
    return round(sum(valid) / len(valid), 1)

async def generate_session_report(session_id: str) -> dict:
    """
    Generates a final report for a session by aggregating
    all response analyses.
    
    Args:
        session_id: ID of the interview session
        
    Returns:
        dict: Final session report
    """
    logger.info(f"Generating report for session: {session_id}")
    
    # This would normally fetch from DB
    # For now return a structured response
    return {
        "sessionId": session_id,
        "success": True,
        "message": "Report generation triggered"
    }