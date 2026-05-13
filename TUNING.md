# Scoring Threshold Tuning

The answer evaluator uses fuzzy phrase matching before the LLM rubric runs. These thresholds control how forgiving that matching is.

## `KEYWORD_FUZZY_THRESHOLD` (default: `86`)

Controls matching for short expected keywords such as tool names, framework names, protocols, and concise concepts. Raise it when unrelated words are being counted as hits. Lower it when correct spoken variants or minor transcription errors are being missed.

- Higher (`90+`): stricter, requires near-exact phrasing
- Lower (`75-80`): more lenient, accepts paraphrases and STT drift
- Recommended range: `80-90` for technical interviews

Recommended calibration:

1. Collect 20-30 transcripts with expected keywords.
2. Mark each keyword as a true hit or miss by hand.
3. Try thresholds from `80` to `92`.
4. Pick the highest threshold that still catches normal speech-to-text spelling drift.

## `KEY_POINT_FUZZY_THRESHOLD` (default: `72`)

Controls matching for longer expected key points. This is lower because full-sentence points are rarely spoken exactly the same way as the reference answer. Raise it if generic answers are getting too much credit. Lower it if paraphrased but correct answers are not being recognized.

- Lower than the keyword threshold intentionally because sentences vary more
- Recommended range: `65-78`

Recommended calibration:

1. Use the same transcript set, but label full key points instead of single terms.
2. Try thresholds from `65` to `80`.
3. Review false positives first; key point matches affect perceived completeness more than keyword matches.

## `LLM_PROVIDER_TIMEOUT_SECONDS` (default: `10`)

Controls the per-provider timeout before fallback triggers. Lower values make the app more responsive during provider outages; higher values reduce fallback frequency when providers are slow.

## Practical Rule

Tune keywords for precision and key points for paraphrase tolerance. After changing either value, rerun the score stability smoke test and a few real session analyses before demoing.
