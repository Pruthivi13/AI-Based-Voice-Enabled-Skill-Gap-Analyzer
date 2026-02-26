"""
Core module for logging initialization.
Sets up appropriate logging output formats and handlers.
"""
import logging
import sys

def setup_logger(name: str) -> logging.Logger:
    """
    Initializes a standardized logger instance.
    """
    # TODO: Fetch logging level from Core Config
    level = logging.INFO
    
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Prevent adding duplicate handlers if the logger already exists
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
