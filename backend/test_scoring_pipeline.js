/**
 * Full no-frontend scoring pipeline check.
 *
 * Requires the ML service on :8000:
 *   cd .. && source venv/bin/activate && uvicorn backend.main:app --port 8000
 *
 * Run from backend/:
 *   node test_scoring_pipeline.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
  console.log(`  [ok] ${message}`);
}

function mapPipelineResultToAnalysis(mlResult) {
  const content = mlResult?.content_scores ?? {};
  const delivery = mlResult?.delivery_scores ?? {};
  const audio = mlResult?.audio_metrics ?? {};
  const wordsPerMinute = Number(audio.words_per_minute);
  const hasUsablePace =
    Boolean(audio.audio_available) &&
    Number.isFinite(wordsPerMinute) &&
    wordsPerMinute > 0;

  return {
    clarityScore: content.clarity ?? null,
    fluencyScore: delivery.fluency ?? null,
    confidenceScore: delivery.confidence_cues ?? null,
    relevanceScore: content.relevance ?? null,
    grammarScore: content.clarity ?? null,
    pronunciationScore: delivery.voice_quality ?? delivery.delivery ?? null,
    technicalScore:
      content.correctness != null && content.completeness != null
        ? Number(((content.correctness + content.completeness) / 2).toFixed(1))
        : content.correctness ?? null,
    fillerWordCount: audio.filler_count ?? null,
    speechRateWpm: hasUsablePace ? Math.round(wordsPerMinute) : null,
    sentiment: mlResult?.label === 'STRONG' ? 'positive' : 'neutral',
    overallScore: mlResult?.overall_score ?? null,
    feedbackJson: [
      mlResult?.feedback,
      ...(Array.isArray(mlResult?.improvements) ? mlResult.improvements : []),
      `LLM provider: ${mlResult?.llm_provider}`,
      `Content scorer: ${mlResult?.content_model_evaluation?.scorer_backend}`,
    ].filter(Boolean),
  };
}

async function callAnalyzer({ response, question, userId }) {
  const form = new URLSearchParams();
  form.append('response_id', response.id);
  form.append('user_id', userId);
  form.append('question_id', question.id);
  form.append('question_text', question.content);
  form.append('transcript', response.transcript);
  form.append('expected_keywords', JSON.stringify(question.expectedKeywords || []));
  form.append('expected_key_points', JSON.stringify([question.referenceAnswer]));
  form.append('ideal_answer', question.referenceAnswer);

  const mlResponse = await fetch(`${ML_URL}/api/analyze-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!mlResponse.ok) {
    const text = await mlResponse.text();
    throw new Error(`ML service returned ${mlResponse.status}: ${text}`);
  }

  return mlResponse.json();
}

async function run() {
  console.log('\nSCORING PIPELINE DB VERIFY\n');

  const health = await fetch(`${ML_URL}/health`);
  assert(health.ok, `ML service is reachable at ${ML_URL}`);

  const suffix = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `pipeline_${suffix}@example.test`,
      supabaseUid: `pipeline_${suffix}`,
      fullName: 'Pipeline Verify User',
      emailVerified: true,
    },
  });

  let questionId;
  try {
    const question = await prisma.question.create({
      data: {
        content: 'Explain REST APIs.',
        category: 'TECHNICAL',
        difficulty: 'EASY',
        expectedKeywords: ['REST', 'stateless', 'HTTP', 'resources', 'GET', 'POST'],
        referenceAnswer:
          'A REST API is stateless, exposes resources through URLs, and uses HTTP methods such as GET, POST, PUT, and DELETE.',
        isActive: true,
      },
    });
    questionId = question.id;

    const session = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        title: 'Pipeline Verify Session',
        interviewType: 'TECHNICAL',
        targetRole: 'Software Engineer',
        difficulty: 'EASY',
        questionCount: 1,
        status: 'PROCESSING',
      },
    });

    const response = await prisma.response.create({
      data: {
        sessionId: session.id,
        questionId: question.id,
        answerOrder: 1,
        transcript:
          'REST APIs are stateless HTTP interfaces. They expose resources through URLs and use methods like GET, POST, PUT, and DELETE.',
      },
    });

    const mlResult = await callAnalyzer({
      response,
      question,
      userId: user.id,
    });

    assert(mlResult.success === true, 'ML analyzer returns success');
    assert(mlResult.llm_provider, `LLM provider recorded: ${mlResult.llm_provider}`);
    assert(mlResult.keyword_analysis.keyword_score >= 8, 'expectedKeywords are evaluated');
    assert(mlResult.content_model_score != null, 'content_scorer contributes to final score');
    assert(mlResult.audio_metrics.audio_available === false, 'transcript-only DB test marks audio unavailable');

    const analysisData = mapPipelineResultToAnalysis(mlResult);
    const analysis = await prisma.responseAnalysis.create({
      data: {
        responseId: response.id,
        ...analysisData,
      },
    });

    assert(analysis.overallScore != null, `ResponseAnalysis saved overallScore=${analysis.overallScore}`);
    assert(analysis.relevanceScore != null, 'ResponseAnalysis saved relevanceScore');
    assert(analysis.technicalScore != null, 'ResponseAnalysis saved technicalScore');

    const report = await prisma.report.create({
      data: {
        sessionId: session.id,
        overallScore: analysis.overallScore ?? 0,
        ratingLabel:
          (analysis.overallScore ?? 0) >= 7
            ? 'Good'
            : (analysis.overallScore ?? 0) >= 5
              ? 'Average'
              : 'Needs Improvement',
        summary: 'Verified no-frontend scoring pipeline.',
        strengthsJson: mlResult.strengths ?? [],
        weaknessesJson: mlResult.improvements ?? [],
        recommendationsJson: ['Continue practicing reference-backed answers.'],
        radarDataJson: {
          labels: ['Communication', 'Confidence', 'Technical', 'Clarity', 'Fluency'],
          values: [
            analysis.clarityScore,
            analysis.confidenceScore,
            analysis.technicalScore,
            analysis.clarityScore,
            analysis.fluencyScore,
          ],
        },
      },
    });

    assert(report.overallScore === analysis.overallScore, 'Report saved from actual analysis');
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: { status: 'COMPLETED', overallScore: analysis.overallScore },
    });
    assert(true, 'Session marked COMPLETED with actual score');

    console.log('\nAll DB pipeline checks passed.\n');
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    if (questionId) {
      await prisma.question.delete({ where: { id: questionId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

run().catch(async (error) => {
  console.error('\nPipeline verification failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
