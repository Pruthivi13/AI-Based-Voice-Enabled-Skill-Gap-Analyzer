#!/bin/bash
# Run all model tests in sequence
# Usage: bash tests/run_all_model_tests.sh

set -e

RED='\033[91m'
GREEN='\033[92m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo "${BOLD}║   AI MODEL — FULL TEST SUITE             ║${RESET}"
echo "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# Test 1 — Groq isolation
echo "${BOLD}[1/4] Groq isolation check...${RESET}"
python tests/test_no_groq_in_scoring.py
echo ""

# Test 2 — Deep model tests
echo "${BOLD}[2/4] Deep model unit tests...${RESET}"
python tests/test_content_model.py
echo ""

# Test 3 — ML endpoint (needs ML service running)
echo "${BOLD}[3/4] ML endpoint integration test...${RESET}"
echo "      (requires: python -m backend.main running on :8000)"
python tests/test_ml_endpoint.py
echo ""

# Test 4 — Full pipeline (needs both services running)
echo "${BOLD}[4/4] Full pipeline + DB test...${RESET}"
echo "      (requires: both services running)"
cd backend && node test_scoring_pipeline.js
cd ..

echo ""
echo "${GREEN}${BOLD}All tests completed.${RESET}"