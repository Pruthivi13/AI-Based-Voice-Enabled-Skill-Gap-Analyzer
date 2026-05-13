# AI Interview Evaluator Pipeline

This repo now includes a FastAPI inference pipeline for spoken interview answer evaluation.

## Endpoints

### `GET /api/questions`

Returns the local question bank from `data/questions.json`.

### `POST /api/upload-audio`

Multipart form-data:

- `audio`: audio file
- `question_id`: question id
- `user_id`: optional, defaults to `anonymous`

Returns the saved local audio path.

### `POST /api/analyze-answer`

Multipart form-data:

- `audio`: audio file, optional if `transcript` is provided
- `transcript`: optional development/testing override
- `question_id`: question id
- `user_id`: optional, defaults to `anonymous`
- `response_id`: optional
- `question_text`: required only when using a dynamic question id not in the bank
- `expected_keywords`: optional JSON array or comma-separated list
- `expected_key_points`: optional JSON array or semicolon/newline-separated list
- `ideal_answer`: optional reference answer

Response includes:

- transcript
- keyword analysis
- content scores
- delivery scores
- audio metrics
- overall score and label
- strengths, improvements, and feedback

### `GET /api/results/{user_id}`

Returns recent evaluator results saved to local SQLite.

## Providers

Speech-to-text:

- Primary: `faster-whisper`
- Fallback: Groq Whisper API if `GROQ_API_KEY` is set

LLM evaluation:

- Primary: Gemini Flash if `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set
- Fallback: Groq if `GROQ_API_KEY` is set
- Last resort: deterministic rubric scoring, so local demos still work without paid APIs

Keyword extraction:

- Uses spaCy when installed. For best results run `python -m spacy download en_core_web_sm`.
- Uses NLTK stopwords when the corpus is available, with a built-in fallback list.
- Uses RapidFuzz when installed to match expected concepts even when the candidate uses different wording.

CPU-friendly delivery analysis:

- `faster-whisper` runs with `int8` CPU inference by default.
- `WHISPER_WORD_TIMESTAMPS=true` enables word timing for hesitation, cadence, and micro-pause metrics.
- `WHISPER_VAD_FILTER=true` enables Whisper's VAD filter to remove non-speech sections before transcription.
- `praat-parselmouth` adds pitch, jitter, shimmer, and harmonicity features for stronger voice-quality and confidence cues.

## Useful Environment Variables

```bash
WHISPER_MODEL_SIZE=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_WORD_TIMESTAMPS=true
WHISPER_VAD_FILTER=true
STT_PROVIDER=local

KEYWORD_FUZZY_THRESHOLD=86
KEY_POINT_FUZZY_THRESHOLD=72

GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash

GROQ_API_KEY=...
GROQ_STT_MODEL=whisper-large-v3-turbo
GROQ_LLM_MODEL=llama-3.1-8b-instant

LLM_PROVIDER_ORDER=gemini,groq
```

## Example Transcript-Only Development Call

```bash
curl -X POST http://localhost:8000/api/analyze-answer \
  -F question_id=q_rest_api \
  -F user_id=demo \
  -F transcript='A REST API uses HTTP methods like GET and POST to access resources. It is stateless.'
```
