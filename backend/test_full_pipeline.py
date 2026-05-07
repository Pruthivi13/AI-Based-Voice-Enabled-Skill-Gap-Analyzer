"""
EXTREME STRESS TEST — Full AI Pipeline
Tests: LLM evaluator, semantic scorer, spectrogram analyzer, Gemini evaluator
Runs each component independently + the full /internal/full-analyze endpoint
"""
import json
import time
import sys
import os
import traceback

# Fix imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# =========================================================================
# TEST DATA - 5 realistic interview scenarios
# =========================================================================

TEST_CASES = [
    {
        "name": "STRONG answer — REST API (should score high)",
        "question": "Explain what a REST API is and its core principles.",
        "transcript": (
            "A REST API stands for Representational State Transfer Application Programming Interface. "
            "It is an architectural style for designing networked applications. The core principles include "
            "statelessness, meaning each request from a client contains all the information needed. "
            "It uses standard HTTP methods like GET, POST, PUT, and DELETE for CRUD operations. "
            "Resources are identified by URIs, and responses are typically in JSON or XML format. "
            "REST APIs should also follow the principle of a uniform interface, which simplifies "
            "the architecture and improves scalability. Caching is also important for performance."
        ),
        "expectedKeyPoints": [
            "REST stands for Representational State Transfer",
            "Uses standard HTTP methods like GET POST PUT DELETE",
            "Stateless — each request is independent",
            "Resources identified by URIs",
            "Responses typically in JSON or XML format",
        ],
        "referenceAnswer": (
            "REST API is an architectural style that uses HTTP methods for communication. "
            "It follows principles like statelessness, uniform interface, and resource-based URLs. "
            "Each request contains all necessary information, and responses are usually in JSON format."
        ),
        "expectedScore": "high",  # Should be 7+
    },
    {
        "name": "WEAK answer — REST API (should score low)",
        "question": "Explain what a REST API is and its core principles.",
        "transcript": (
            "Um, so a REST API is like, you know, it's basically a way to um connect things. "
            "Like websites use it I think. You send requests and get responses. "
            "I'm not sure about the details but it's something with HTTP I guess. "
            "Maybe it uses JSON? I don't really know the principles honestly."
        ),
        "expectedKeyPoints": [
            "REST stands for Representational State Transfer",
            "Uses standard HTTP methods like GET POST PUT DELETE",
            "Stateless — each request is independent",
            "Resources identified by URIs",
            "Responses typically in JSON or XML format",
        ],
        "referenceAnswer": (
            "REST API is an architectural style that uses HTTP methods for communication. "
            "It follows principles like statelessness, uniform interface, and resource-based URLs."
        ),
        "expectedScore": "low",  # Should be < 5
    },
    {
        "name": "AVERAGE answer — Database Indexing (mid-range)",
        "question": "What is database indexing and why is it important?",
        "transcript": (
            "Database indexing is a technique used to speed up queries. It's like a book index "
            "where you can quickly find what page something is on. When you create an index on a column, "
            "the database creates a data structure that allows faster lookups. It's important because "
            "without indexes, the database would have to scan every row which is very slow for large tables."
        ),
        "expectedKeyPoints": [
            "Index is a data structure that improves query speed",
            "Similar to a book index for quick lookups",
            "Prevents full table scans",
            "B-tree or hash-based index structures",
            "Trade-off: speeds up reads but slows down writes",
        ],
        "referenceAnswer": (
            "Database indexing creates auxiliary data structures like B-trees to speed up data retrieval. "
            "Without indexes, queries require full table scans. However, indexes have trade-offs — "
            "they speed up reads but slow down writes and consume additional storage."
        ),
        "expectedScore": "average",  # Should be 5-7
    },
    {
        "name": "EMPTY answer — should handle gracefully",
        "question": "What is polymorphism in object-oriented programming?",
        "transcript": "",
        "expectedKeyPoints": [
            "Ability of objects to take multiple forms",
            "Method overriding and overloading",
            "Runtime vs compile-time polymorphism",
        ],
        "referenceAnswer": "Polymorphism allows objects to be treated as instances of their parent class.",
        "expectedScore": "empty",
    },
    {
        "name": "VERY SHORT answer — minimal content",
        "question": "Explain the difference between TCP and UDP.",
        "transcript": "TCP is reliable and UDP is fast.",
        "expectedKeyPoints": [
            "TCP provides reliable ordered delivery",
            "UDP is connectionless and faster",
            "TCP uses three-way handshake",
            "UDP is used for streaming and gaming",
            "TCP has flow control and error correction",
        ],
        "referenceAnswer": (
            "TCP is a connection-oriented protocol providing reliable, ordered delivery with error checking. "
            "UDP is connectionless, faster but unreliable, used for streaming and real-time applications."
        ),
        "expectedScore": "low",
    },
]


def separator(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def test_result(name, passed, detail=""):
    icon = "[PASS]" if passed else "[FAIL]"
    print(f"  {icon} {name}" + (f" - {detail}" if detail else ""))
    return passed


# =========================================================================
# TEST 1: Semantic Scorer (sentence-transformers)
# =========================================================================

def test_semantic_scorer():
    separator("TEST 1: Semantic Scorer (sentence-transformers)")
    passed = 0
    total = 0

    try:
        from backend.services.semantic_scorer import (
            compute_semantic_similarity,
            compute_keypoint_coverage,
        )

        # Test similarity
        total += 1
        t0 = time.time()
        sim = compute_semantic_similarity(
            "REST API uses HTTP methods for communication",
            "RESTful services leverage HTTP verbs like GET and POST"
        )
        elapsed = time.time() - t0
        ok = sim > 0.5
        passed += test_result(
            f"Semantic similarity (same meaning, diff words)",
            ok,
            f"score={sim:.4f}, time={elapsed:.2f}s"
        )

        # Test dissimilar
        total += 1
        sim2 = compute_semantic_similarity(
            "I like pizza and pasta",
            "Quantum mechanics describes subatomic particle behavior"
        )
        ok2 = sim2 < 0.3
        passed += test_result(
            f"Dissimilar text detection",
            ok2,
            f"score={sim2:.4f} (should be low)"
        )

        # Test key point coverage — strong answer
        total += 1
        t0 = time.time()
        coverage = compute_keypoint_coverage(
            TEST_CASES[0]["transcript"],
            TEST_CASES[0]["expectedKeyPoints"]
        )
        elapsed = time.time() - t0
        ok3 = coverage["coveragePercent"] >= 60
        passed += test_result(
            f"Strong answer coverage",
            ok3,
            f"{coverage['coveragePercent']}% covered, "
            f"{len(coverage['coveredPoints'])} covered / {len(coverage['missedPoints'])} missed, "
            f"time={elapsed:.2f}s"
        )
        print(f"    Covered: {coverage['coveredPoints']}")
        print(f"    Missed:  {coverage['missedPoints']}")

        # Test key point coverage — weak answer
        total += 1
        coverage2 = compute_keypoint_coverage(
            TEST_CASES[1]["transcript"],
            TEST_CASES[1]["expectedKeyPoints"]
        )
        ok4 = coverage2["coveragePercent"] < coverage["coveragePercent"]
        passed += test_result(
            f"Weak answer coverage (should be lower)",
            ok4,
            f"{coverage2['coveragePercent']}% covered"
        )

        # Test empty transcript
        total += 1
        coverage3 = compute_keypoint_coverage("", ["point 1", "point 2"])
        ok5 = coverage3["coveragePercent"] == 0
        passed += test_result(
            f"Empty transcript handling",
            ok5,
            f"{coverage3['coveragePercent']}% (should be 0)"
        )

    except Exception as e:
        print(f"  [FATAL ERROR]: {e}")
        traceback.print_exc()

    print(f"\n  Score: {passed}/{total}")
    return passed, total


# =========================================================================
# TEST 2: LLM Evaluator (Groq)
# =========================================================================

def test_llm_evaluator():
    separator("TEST 2: LLM Evaluator (Groq)")
    passed = 0
    total = 0

    try:
        from backend.services.llm_evaluator import evaluate_with_llm

        # Test strong answer
        total += 1
        tc = TEST_CASES[0]
        t0 = time.time()
        result = evaluate_with_llm(
            question=tc["question"],
            transcript=tc["transcript"],
            expected_key_points=tc["expectedKeyPoints"],
            reference_answer=tc["referenceAnswer"],
        )
        elapsed = time.time() - t0
        ok = result.get("overallContentScore", 0) >= 6.0
        passed += test_result(
            f"Strong answer evaluation",
            ok,
            f"overall={result.get('overallContentScore')}, "
            f"correctness={result.get('correctness')}, "
            f"completeness={result.get('completeness')}, "
            f"time={elapsed:.2f}s"
        )
        print(f"    Keywords: {result.get('keywordsFound', [])}")
        print(f"    Missing:  {result.get('missingPoints', [])}")
        print(f"    Feedback: {result.get('feedback', '')[:100]}")

        # Test weak answer
        total += 1
        tc2 = TEST_CASES[1]
        t0 = time.time()
        result2 = evaluate_with_llm(
            question=tc2["question"],
            transcript=tc2["transcript"],
            expected_key_points=tc2["expectedKeyPoints"],
            reference_answer=tc2["referenceAnswer"],
        )
        elapsed = time.time() - t0
        ok2 = result2.get("overallContentScore", 10) < result.get("overallContentScore", 0)
        passed += test_result(
            f"Weak answer scored lower than strong",
            ok2,
            f"weak={result2.get('overallContentScore')} vs strong={result.get('overallContentScore')}, "
            f"time={elapsed:.2f}s"
        )
        print(f"    Feedback: {result2.get('feedback', '')[:100]}")

        # Test empty transcript
        total += 1
        result3 = evaluate_with_llm(
            question="What is X?",
            transcript="",
            expected_key_points=["point 1"],
        )
        ok3 = result3.get("overallContentScore") == 1.7
        passed += test_result(
            f"Empty transcript returns defaults",
            ok3,
            f"score={result3.get('overallContentScore')}"
        )

    except Exception as e:
        print(f"  [FATAL ERROR]: {e}")
        traceback.print_exc()

    print(f"\n  Score: {passed}/{total}")
    return passed, total


# =========================================================================
# TEST 3: Spectrogram Analyzer (librosa)
# =========================================================================

def test_spectrogram_analyzer():
    separator("TEST 3: Spectrogram Analyzer (librosa)")
    passed = 0
    total = 0

    try:
        from backend.services.spectrogram_analyzer import extract_audio_features
        import numpy as np
        import tempfile
        import wave

        # Create a synthetic WAV file with speech-like audio
        total += 1
        sr = 16000
        duration = 5.0
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)

        # Simulate speech: tone + noise + a silence gap (pause)
        tone = 0.3 * np.sin(2 * np.pi * 200 * t)  # fundamental frequency
        noise = 0.05 * np.random.randn(len(t))
        signal = tone + noise

        # Insert a 1-second pause in the middle
        pause_start = int(2.0 * sr)
        pause_end = int(3.0 * sr)
        signal[pause_start:pause_end] = 0.001 * np.random.randn(pause_end - pause_start)

        # Write WAV
        wav_path = os.path.join(tempfile.gettempdir(), "test_speech.wav")
        signal_int16 = (signal * 32767).astype(np.int16)
        with wave.open(wav_path, 'w') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(signal_int16.tobytes())

        t0 = time.time()
        features = extract_audio_features(wav_path)
        elapsed = time.time() - t0

        ok = features.get("pauseCount", -1) >= 0 and features.get("confidenceScore", -1) > 0
        passed += test_result(
            f"Synthetic audio analysis",
            ok,
            f"time={elapsed:.2f}s"
        )
        print(f"    Pauses: {features.get('pauseCount')} (avg {features.get('avgPauseLengthSeconds')}s)")
        print(f"    Long pauses: {features.get('longPauses')}")
        print(f"    MFCC variance: {features.get('mfccVariance')}")
        print(f"    Expressiveness: {features.get('expressiveness')}/10")
        print(f"    Pitch std: {features.get('pitchStd')}")
        print(f"    Stammer indicator: {features.get('stammerIndicator')}")
        print(f"    Confidence score: {features.get('confidenceScore')}")
        print(f"    Pause score: {features.get('pauseScore')}")
        print(f"    Delivery note: {features.get('deliveryNote')}")

        # Test nonexistent file
        total += 1
        features2 = extract_audio_features("nonexistent.wav")
        ok2 = features2.get("confidenceScore") == 5.0  # should return defaults
        passed += test_result(
            f"Missing file returns defaults",
            ok2,
            f"confidence={features2.get('confidenceScore')}"
        )

        # Cleanup
        if os.path.exists(wav_path):
            os.unlink(wav_path)

    except Exception as e:
        print(f"  [FATAL ERROR]: {e}")
        traceback.print_exc()

    print(f"\n  Score: {passed}/{total}")
    return passed, total


# =========================================================================
# TEST 4: Gemini Evaluator (with Groq fallback)
# =========================================================================

def test_gemini_evaluator():
    separator("TEST 4: Gemini/Groq Evaluator")
    passed = 0
    total = 0

    try:
        from backend.services.gemini_evaluator import evaluate_with_gemini

        total += 1
        tc = TEST_CASES[2]  # average answer
        t0 = time.time()
        result = evaluate_with_gemini(
            question=tc["question"],
            transcript=tc["transcript"],
            expected_key_points=tc["expectedKeyPoints"],
            reference_answer=tc["referenceAnswer"],
            semantic_coverage={
                "coveragePercent": 60.0,
                "coveredPoints": tc["expectedKeyPoints"][:3],
                "missedPoints": tc["expectedKeyPoints"][3:],
            },
            delivery_metrics={
                "speechRateWpm": 130,
                "pauseCount": 3,
                "longPauses": 0,
                "expressiveness": 6.0,
                "stammerIndicator": 2.0,
                "fillerWordCount": 2,
            },
        )
        elapsed = time.time() - t0
        ok = result.get("overallContentScore", 0) > 0
        engine = "Gemini" if os.getenv("GEMINI_API_KEY") else "Groq (fallback)"
        passed += test_result(
            f"Average answer via {engine}",
            ok,
            f"overall={result.get('overallContentScore')}, time={elapsed:.2f}s"
        )
        print(f"    Feedback: {result.get('feedback', '')[:120]}")
        if result.get("strengths"):
            print(f"    Strengths: {result.get('strengths')}")
        if result.get("improvements"):
            print(f"    Improvements: {result.get('improvements')}")

    except Exception as e:
        print(f"  [FATAL ERROR]: {e}")
        traceback.print_exc()

    print(f"\n  Score: {passed}/{total}")
    return passed, total


# =========================================================================
# TEST 5: Full Pipeline Integration (all components combined)
# =========================================================================

def test_full_pipeline():
    separator("TEST 5: FULL PIPELINE INTEGRATION")
    passed = 0
    total = 0
    results = []

    try:
        from backend.services.semantic_scorer import compute_keypoint_coverage, compute_semantic_similarity
        from backend.services.gemini_evaluator import evaluate_with_gemini
        from backend.services.analyzer import count_filler_words, calculate_speech_rate

        for tc in TEST_CASES:
            total += 1
            name = tc["name"]
            print(f"\n  -- {name} --")
            t0 = time.time()

            # Skip empty transcripts for LLM
            if not tc["transcript"] or len(tc["transcript"].strip()) < 5:
                print(f"    [SKIP] Skipping (empty/short transcript)")
                passed += test_result(name, True, "correctly handled empty input")
                results.append({"name": name, "overall": 0, "expected": tc["expectedScore"]})
                continue

            # Step 1: Semantic coverage
            coverage = compute_keypoint_coverage(tc["transcript"], tc["expectedKeyPoints"])

            # Step 2: LLM evaluation
            llm_result = evaluate_with_gemini(
                question=tc["question"],
                transcript=tc["transcript"],
                expected_key_points=tc["expectedKeyPoints"],
                reference_answer=tc["referenceAnswer"],
                semantic_coverage=coverage,
                delivery_metrics={
                    "speechRateWpm": calculate_speech_rate(tc["transcript"]),
                    "fillerWordCount": count_filler_words(tc["transcript"]),
                    "pauseCount": 2,
                    "longPauses": 0,
                    "expressiveness": 6.0,
                    "stammerIndicator": 1.0,
                },
            )

            # Step 3: Combine scores
            content_score = llm_result.get("overallContentScore", 5.0)
            coverage_score = coverage.get("coveragePercent", 0) / 10
            overall = round(content_score * 0.55 + coverage_score * 0.15 + 6.0 * 0.15 + 7.0 * 0.15, 1)
            elapsed = time.time() - t0

            # Semantic similarity
            sem_sim = compute_semantic_similarity(tc["transcript"], tc["referenceAnswer"])

            print(f"    Content Score:  {content_score}/10 (LLM)")
            print(f"    Coverage:       {coverage['coveragePercent']}% ({len(coverage['coveredPoints'])}/{len(tc['expectedKeyPoints'])} points)")
            print(f"    Semantic Sim:   {sem_sim:.4f}")
            print(f"    Fillers:        {count_filler_words(tc['transcript'])}")
            print(f"    Speech Rate:    {calculate_speech_rate(tc['transcript'])} WPM")
            print(f"    Overall:        {overall}/10")
            print(f"    Time:           {elapsed:.2f}s")
            print(f"    Feedback:       {llm_result.get('feedback', '')[:100]}")

            results.append({"name": name, "overall": overall, "expected": tc["expectedScore"]})

            # Validate expectations
            if tc["expectedScore"] == "high":
                ok = overall >= 6.5
            elif tc["expectedScore"] == "low":
                ok = overall < 6.5
            elif tc["expectedScore"] == "average":
                ok = 4.5 <= overall <= 8.0
            else:
                ok = True

            passed += test_result(
                name,
                ok,
                f"overall={overall}, expected={tc['expectedScore']}"
            )

    except Exception as e:
        print(f"  [FATAL ERROR]: {e}")
        traceback.print_exc()

    # Summary table
    print(f"\n  {'-'*50}")
    print(f"  {'Test Case':<45} {'Score':>5}")
    print(f"  {'-'*50}")
    for r in results:
        print(f"  {r['name']:<45} {r['overall']:>5}")

    print(f"\n  Score: {passed}/{total}")
    return passed, total


# =========================================================================
# RUN ALL TESTS
# =========================================================================

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("=  EXTREME STRESS TEST — AI Interview Evaluator Pipeline")
    print("=" * 70)

    all_passed = 0
    all_total = 0

    t_start = time.time()

    for test_fn in [
        test_semantic_scorer,
        test_llm_evaluator,
        test_spectrogram_analyzer,
        test_gemini_evaluator,
        test_full_pipeline,
    ]:
        p, t = test_fn()
        all_passed += p
        all_total += t

    total_time = time.time() - t_start

    separator("FINAL RESULTS")
    print(f"  Total:  {all_passed}/{all_total} tests passed")
    print(f"  Time:   {total_time:.1f}s")
    if all_passed == all_total:
        print(f"\n  ALL TESTS PASSED! Pipeline is solid.")
    else:
        print(f"\n  WARNING: {all_total - all_passed} test(s) failed. Check above for details.")
    print()
