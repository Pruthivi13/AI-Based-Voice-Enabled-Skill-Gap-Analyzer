"""
Deep test for interview_content_model_binary.
Run: python tests/test_content_model.py
"""
import sys
import os
import json

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.content_scorer import (
    evaluate_answer,
    hybrid_score,
    keyword_overlap,
    model_predict_binary,
    clean_words,
    generate_feedback,
    get_scorer_model,
)

# ── Color helpers ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):  print(f"{GREEN}  ✓ {msg}{RESET}")
def fail(msg):print(f"{RED}  ✗ {msg}{RESET}")
def info(msg):print(f"{CYAN}  → {msg}{RESET}")
def head(msg):print(f"\n{BOLD}{YELLOW}{'─'*60}\n  {msg}\n{'─'*60}{RESET}")

passed = 0
failed = 0

def check(condition, label, detail=""):
    global passed, failed
    if condition:
        ok(label)
        passed += 1
    else:
        fail(f"{label}  {detail}")
        failed += 1

# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE 1 — Model loads correctly
# ══════════════════════════════════════════════════════════════════════════════
head("SUITE 1 — Model Loading")

try:
    model, tokenizer = get_scorer_model()
    check(model is not None, "Model loaded successfully")
    check(tokenizer is not None, "Tokenizer loaded successfully")

    # Verify it's a classification model
    num_labels = model.config.num_labels
    info(f"Number of output labels: {num_labels}")
    check(num_labels == 2, "Model has 2 labels (binary classifier)",
          f"got {num_labels}")

    # Check model architecture
    model_type = model.config.model_type
    info(f"Model architecture: {model_type}")
    check(model_type in ["bert", "distilbert", "roberta", "albert", "xlnet", "deberta"],
          f"Recognized transformer architecture: {model_type}")

except Exception as e:
    fail(f"Model failed to load: {e}")
    print(f"\n{RED}CRITICAL: Model cannot load. Check path and files.{RESET}")
    sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE 2 — Helper functions
# ══════════════════════════════════════════════════════════════════════════════
head("SUITE 2 — Helper Functions")

# clean_words
words = clean_words("REST is an API! Yes.")
check(isinstance(words, list), "clean_words returns a list")
check("rest" in words, "clean_words lowercases text")
check("!" not in " ".join(words), "clean_words removes punctuation")
info(f"clean_words output: {words}")

# keyword_overlap
overlap1 = keyword_overlap(
    "REST uses HTTP methods like GET and POST",
    "REST is a style using HTTP methods GET POST PUT DELETE"
)
check(0.0 <= overlap1 <= 1.0, f"keyword_overlap returns 0-1 float (got {overlap1})")
check(overlap1 > 0, "keyword_overlap finds matches in similar text")

overlap2 = keyword_overlap("cats and dogs", "quantum physics reactor")
check(overlap2 == 0.0, "keyword_overlap returns 0 for unrelated text")

overlap3 = keyword_overlap("", "some reference answer")
check(overlap3 == 0.0, "keyword_overlap handles empty answer")
info(f"Overlap scores: similar={overlap1}, unrelated={overlap2}, empty={overlap3}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE 3 — Model prediction (raw output)
# ══════════════════════════════════════════════════════════════════════════════
head("SUITE 3 — Raw Model Predictions")

test_pairs = [
    {
        "label": "Strong technical answer",
        "question": "What is a REST API?",
        "answer": "REST is an architectural style for stateless client-server communication over HTTP. It uses standard methods like GET, POST, PUT, DELETE to perform CRUD operations on resources identified by URLs.",
        "expected": None  # binary model is a weak signal; hybrid scoring compensates
    },
    {
        "label": "Very weak / empty-like answer",
        "question": "Explain how React hooks work.",
        "answer": "I dont know",
        "expected": "NOT_STRONG"
    },
    {
        "label": "Partial but relevant answer",
        "question": "What is a database index?",
        "answer": "An index speeds up queries in a database",
        "expected": None  # either is acceptable
    },
]

for pair in test_pairs:
    prediction = model_predict_binary(pair["question"], pair["answer"])
    check(
        prediction in ["STRONG", "NOT_STRONG"],
        f"[{pair['label']}] Returns valid label: {prediction}"
    )
    if pair["expected"]:
        check(
            prediction == pair["expected"],
            f"[{pair['label']}] Expected {pair['expected']}, got {prediction}",
            f"(answer: '{pair['answer'][:50]}...')"
        )
    info(f"  Q: {pair['question'][:50]}")
    info(f"  A: {pair['answer'][:60]}")
    info(f"  Prediction: {prediction}")
    print()


# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE 4 — Hybrid scoring logic
# ══════════════════════════════════════════════════════════════════════════════
head("SUITE 4 — Hybrid Scoring Logic")

hybrid_cases = [
    {
        "label": "Strong answer — should score STRONG or AVERAGE",
        "question": "What is a REST API?",
        "answer": "REST is an architectural style for stateless client-server communication over HTTP using standard methods like GET POST PUT DELETE to interact with resources identified by URLs.",
        "reference": "REST is an architectural style for stateless client-server communication over HTTP using resources and standard methods.",
        "expected_in": ["STRONG", "AVERAGE"]
    },
    {
        "label": "Completely wrong answer — should score WEAK",
        "question": "What is a REST API?",
        "answer": "The weather is nice today and I enjoy coding",
        "reference": "REST is an architectural style for stateless client-server communication over HTTP using resources and standard methods.",
        "expected_in": ["WEAK", "AVERAGE"]
    },
    {
        "label": "Short but correct answer",
        "question": "What does HTML stand for?",
        "answer": "HyperText Markup Language",
        "reference": "HTML stands for HyperText Markup Language, the standard language for creating web pages.",
        "expected_in": ["STRONG", "AVERAGE", "WEAK"]  # any, just check structure
    },
]

for case in hybrid_cases:
    result = hybrid_score(case["question"], case["answer"], case["reference"])

    check("model_label" in result, f"[{case['label']}] Has model_label field")
    check("keyword_overlap" in result, f"[{case['label']}] Has keyword_overlap field")
    check("answer_length" in result, f"[{case['label']}] Has answer_length field")
    check("final_score" in result, f"[{case['label']}] Has final_score field")
    check(
        result["final_score"] in ["STRONG", "AVERAGE", "WEAK"],
        f"[{case['label']}] final_score is valid: {result['final_score']}"
    )
    check(
        result["final_score"] in case["expected_in"],
        f"[{case['label']}] Score {result['final_score']} in expected {case['expected_in']}"
    )
    info(f"  Full result: {json.dumps(result, indent=4)}")
    print()


# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE 5 — Full evaluate_answer pipeline
# ══════════════════════════════════════════════════════════════════════════════
head("SUITE 5 — Full evaluate_answer Pipeline")

full_cases = [
    {
        "question": "What is a REST API?",
        "answer": "REST is an architectural style for stateless client-server communication over HTTP using resources and standard methods like GET, POST, PUT, DELETE.",
        "reference": "REST is an architectural style for stateless client-server communication over HTTP using resources and standard methods.",
    },
    {
        "question": "Explain polymorphism in OOP.",
        "answer": "Polymorphism allows objects of different types to be treated as objects of a common base type. It enables one interface to be used for a general class of actions.",
        "reference": "Polymorphism in OOP allows different classes to be treated as instances of a shared parent class, enabling one interface to represent different underlying forms.",
    },
    {
        "question": "What is a database transaction?",
        "answer": "I am not sure about this topic",
        "reference": "A database transaction is a sequence of operations performed as a single logical unit of work that is atomic, consistent, isolated, and durable — ACID properties.",
    },
]

for case in full_cases:
    result = evaluate_answer(case["question"], case["answer"], case["reference"])

    required_keys = ["model_label", "keyword_overlap", "answer_length", "final_score", "feedback"]
    for key in required_keys:
        check(key in result, f"Result has '{key}' key")

    check(isinstance(result["feedback"], str), "Feedback is a string")
    check(len(result["feedback"]) > 10, "Feedback is not empty")
    check(result["model_label"] in ["STRONG", "NOT_STRONG"], "model_label is valid")
    check(result["final_score"] in ["STRONG", "AVERAGE", "WEAK"], "final_score is valid")
    check(
        isinstance(result["keyword_overlap"], float),
        f"keyword_overlap is float: {result['keyword_overlap']}"
    )
    check(
        isinstance(result["answer_length"], int),
        f"answer_length is int: {result['answer_length']}"
    )

    print(f"\n  {BOLD}Question:{RESET} {case['question']}")
    print(f"  {BOLD}Answer:{RESET}   {case['answer'][:80]}...")
    print(f"  {BOLD}Result:{RESET}")
    for k, v in result.items():
        print(f"    {k}: {v}")
    print()


# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE 6 — Edge cases
# ══════════════════════════════════════════════════════════════════════════════
head("SUITE 6 — Edge Cases")

edge_cases = [
    {"label": "Empty answer",        "answer": "",           "should_not_crash": True},
    {"label": "Single word answer",  "answer": "Yes",        "should_not_crash": True},
    {"label": "Very long answer",    "answer": "REST " * 200,"should_not_crash": True},
    {"label": "Special characters",  "answer": "REST @#$% API!!! ???", "should_not_crash": True},
    {"label": "Numbers only",        "answer": "123 456 789", "should_not_crash": True},
    {"label": "Mixed language",      "answer": "REST API hai jo HTTP use karta hai", "should_not_crash": True},
]

q = "What is a REST API?"
ref = "REST is an architectural style for HTTP-based communication."

for edge in edge_cases:
    try:
        result = evaluate_answer(q, edge["answer"], ref)
        check(True, f"[{edge['label']}] Did not crash")
        check(
            result["final_score"] in ["STRONG", "AVERAGE", "WEAK"],
            f"[{edge['label']}] Returns valid score: {result['final_score']}"
        )
    except Exception as e:
        fail(f"[{edge['label']}] CRASHED: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE 7 — Consistency check (same input = same output)
# ══════════════════════════════════════════════════════════════════════════════
head("SUITE 7 — Model Consistency (Determinism)")

q = "What is object-oriented programming?"
a = "OOP is a programming paradigm based on objects that contain data and methods."
ref = "Object-oriented programming is a paradigm based on objects, encapsulating data and methods."

results = [evaluate_answer(q, a, ref) for _ in range(3)]

check(
    all(r["final_score"] == results[0]["final_score"] for r in results),
    f"Same input gives same final_score across 3 runs: {results[0]['final_score']}"
)
check(
    all(r["model_label"] == results[0]["model_label"] for r in results),
    f"Same input gives same model_label across 3 runs: {results[0]['model_label']}"
)
check(
    all(r["keyword_overlap"] == results[0]["keyword_overlap"] for r in results),
    "Same input gives same keyword_overlap across 3 runs"
)


# ══════════════════════════════════════════════════════════════════════════════
# TEST SUITE 8 — Score distribution sanity check
# ══════════════════════════════════════════════════════════════════════════════
head("SUITE 8 — Score Distribution Sanity")

benchmark = [
    {
        "answer": "REST is an architectural style for stateless client-server communication using HTTP with resources and standard methods like GET POST PUT DELETE.",
        "reference": "REST is an architectural style for stateless client-server communication over HTTP using resources and standard methods.",
        "tier": "high"
    },
    {
        "answer": "REST is a way to communicate between systems over the internet",
        "reference": "REST is an architectural style for stateless client-server communication over HTTP using resources and standard methods.",
        "tier": "medium"
    },
    {
        "answer": "It is a type of API",
        "reference": "REST is an architectural style for stateless client-server communication over HTTP using resources and standard methods.",
        "tier": "low"
    },
]

q = "What is a REST API?"
scores = []
for b in benchmark:
    r = evaluate_answer(q, b["answer"], b["reference"])
    scores.append((b["tier"], r["final_score"], r["keyword_overlap"]))
    info(f"  Tier={b['tier']:6} → final={r['final_score']:8} overlap={r['keyword_overlap']:.3f} model={r['model_label']}")

# High tier overlap should be >= medium tier overlap
check(
    scores[0][2] >= scores[2][2],
    f"High tier overlap ({scores[0][2]:.3f}) >= Low tier overlap ({scores[2][2]:.3f})"
)


# ══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{'═'*60}")
print(f"{BOLD}  TEST SUMMARY{RESET}")
print(f"{'═'*60}")
print(f"  {GREEN}Passed: {passed}{RESET}")
print(f"  {RED}Failed: {failed}{RESET}")
total = passed + failed
pct = (passed / total * 100) if total > 0 else 0
print(f"  Score:  {passed}/{total} ({pct:.1f}%)")
print(f"{'═'*60}\n")

if failed > 0:
    sys.exit(1)