"""
Verifies content_scorer.py does NOT call Groq.
Run: python tests/test_no_groq_in_scoring.py
"""
import sys
import os
import inspect

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import backend.services.content_scorer as scorer_module

source = inspect.getsource(scorer_module)

print("\n══════════════════════════════════════════")
print("  GROQ ISOLATION CHECK")
print("══════════════════════════════════════════\n")

checks = [
    ("groq" not in source.lower(),        "content_scorer.py has NO groq import"),
    ("openai" not in source.lower(),       "content_scorer.py has NO openai import"),
    ("requests" not in source.lower(),     "content_scorer.py has NO HTTP calls"),
    ("AutoModelForSequenceClassification" in source, "Uses HuggingFace classification model"),
    ("AutoTokenizer" in source,            "Uses HuggingFace tokenizer"),
    ("torch" in source,                    "Uses PyTorch for inference"),
    ("MODEL_PATH" in source,               "Loads from local MODEL_PATH"),
]

all_pass = True
for condition, label in checks:
    sym = "✓" if condition else "✗"
    col = "\033[92m" if condition else "\033[91m"
    print(f"  {col}{sym} {label}\033[0m")
    if not condition:
        all_pass = False

print(f"\n  {'All checks passed — model is self-contained' if all_pass else 'FAILURES DETECTED'}")
print("══════════════════════════════════════════\n")

sys.exit(0 if all_pass else 1)