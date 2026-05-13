import os

if os.getenv("RUN_LIVE_LLM_STABILITY") != "1":
    os.environ["LLM_PROVIDER_ORDER"] = ""

from backend.services.llm_service import evaluate_content

Q = "Explain the OSI model."
T = "The OSI model has seven layers: physical, data link, network, transport, session, presentation, and application."
K = ["physical layer", "network layer", "transport layer"]
P = ["OSI has 7 layers", "transport layer handles end-to-end delivery"]

results = [evaluate_content(Q, T, K, P) for _ in range(5)]
scores = [(r["relevance_score"], r["correctness_score"]) for r in results]
assert len(set(scores)) == 1, f"Scores not stable: {scores}"
print("Score stability confirmed")
