"""
Tests the /internal/evaluate-answer endpoint on the running ML service.
Run AFTER starting: python -m backend.main
Then: python tests/test_ml_endpoint.py
"""
import sys
import requests
import json

BASE = "http://localhost:8000"

GREEN = "\033[92m"
RED   = "\033[91m"
CYAN  = "\033[96m"
BOLD  = "\033[1m"
RESET = "\033[0m"

passed = 0
failed = 0

def check(condition, label, detail=""):
    global passed, failed
    if condition:
        print(f"{GREEN}  ✓ {label}{RESET}")
        passed += 1
    else:
        print(f"{RED}  ✗ {label}  {detail}{RESET}")
        failed += 1

def post(payload):
    r = requests.post(
        f"{BASE}/internal/evaluate-answer",
        json=payload,
        timeout=30
    )
    return r.status_code, r.json()

print(f"\n{BOLD}Testing ML service at {BASE}{RESET}\n")

# ── Check ML service is alive ─────────────────────────────────────────────────
try:
    r = requests.get(f"{BASE}/health", timeout=5)
    check(r.status_code == 200, "ML service is running")
except Exception as e:
    print(f"{RED}  CRITICAL: ML service not running. Start it first.{RESET}")
    sys.exit(1)

# ── Test 1: Strong answer ─────────────────────────────────────────────────────
print(f"\n{BOLD}Test 1 — Strong answer{RESET}")
status, body = post({
    "question": "What is a REST API?",
    "answer": "REST is an architectural style for stateless client-server communication over HTTP. It uses methods like GET POST PUT DELETE to operate on resources.",
    "reference": "REST is an architectural style for stateless client-server communication over HTTP using resources and standard methods."
})
check(status == 200, f"HTTP 200 (got {status})")
check("final_score" in body, "Response has final_score")
check("model_label" in body, "Response has model_label")
check("keyword_overlap" in body, "Response has keyword_overlap")
check("answer_length" in body, "Response has answer_length")
check("feedback" in body, "Response has feedback")
check(body.get("success") is True, "success flag is True")
check(body.get("model_label") in ["STRONG", "NOT_STRONG"], "model_label is valid")
check(body.get("final_score") in ["STRONG", "AVERAGE", "WEAK"], "final_score is valid")
print(f"\n  Full response:\n{json.dumps(body, indent=4)}")

# ── Test 2: Weak answer ───────────────────────────────────────────────────────
print(f"\n{BOLD}Test 2 — Weak/irrelevant answer{RESET}")
status, body = post({
    "question": "Explain polymorphism in OOP.",
    "answer": "I don't know this topic at all",
    "reference": "Polymorphism allows objects of different types to be treated as a common parent type."
})
check(status == 200, f"HTTP 200 (got {status})")
check(body.get("final_score") in ["WEAK", "AVERAGE"], f"Weak answer scored low: {body.get('final_score')}")
print(f"\n  Full response:\n{json.dumps(body, indent=4)}")

# ── Test 3: Missing fields ────────────────────────────────────────────────────
print(f"\n{BOLD}Test 3 — Missing required field{RESET}")
r = requests.post(f"{BASE}/internal/evaluate-answer", json={"question": "test"}, timeout=10)
check(r.status_code == 422, f"Returns 422 for missing fields (got {r.status_code})")

# ── Test 4: Empty answer ──────────────────────────────────────────────────────
print(f"\n{BOLD}Test 4 — Empty answer string{RESET}")
status, body = post({
    "question": "What is SQL?",
    "answer": "",
    "reference": "SQL is a language for managing relational databases."
})
check(status == 200, f"HTTP 200 for empty answer (got {status})")
check(body.get("final_score") in ["WEAK", "AVERAGE", "STRONG"], "Returns a valid score")
print(f"\n  Full response:\n{json.dumps(body, indent=4)}")

# ── Summary ───────────────────────────────────────────────────────────────────
total = passed + failed
print(f"\n{'═'*50}")
print(f"  {passed}/{total} tests passed")
print(f"{'═'*50}\n")
if failed > 0:
    sys.exit(1)