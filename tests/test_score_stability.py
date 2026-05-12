import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

if os.getenv("RUN_LIVE_LLM_STABILITY") != "1":
    os.environ["LLM_PROVIDER_ORDER"] = ""

from backend.services.llm_service import evaluate_content


QUESTION = "Explain the OSI model."
TRANSCRIPT = (
    "The OSI model has seven layers: physical, data link, network, transport, "
    "session, presentation, and application."
)
KEYWORDS = ["physical layer", "network layer", "transport layer"]
POINTS = [
    "OSI has 7 layers",
    "transport layer handles end-to-end delivery",
]


def test_score_stability():
    results = [
        evaluate_content(QUESTION, TRANSCRIPT, KEYWORDS, POINTS)
        for _ in range(5)
    ]
    scores = [
        (
            result["relevance_score"],
            result["correctness_score"],
            result["completeness_score"],
        )
        for result in results
    ]

    assert len(set(scores)) == 1, f"Scores are not stable: {scores}"


if __name__ == "__main__":
    test_score_stability()
    print("All stable")
