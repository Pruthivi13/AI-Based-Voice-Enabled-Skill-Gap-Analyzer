import prisma from '../../config/prisma';
import supabase from '../../config/supabase';
import { ApiError } from '../../utils/apiError';
import {
  analyzeAnswerPipeline,
  analyzeResponse,
} from '../../services/mlClient.service';
import { logger } from '../../utils/logger';
import { updateStreak } from '../../services/streak.service';
import { captureSkillSnapshot } from '../../services/skillSnapshot.service';
import { buildEvaluationRubric } from '../../utils/questionRubric';

const SIGNED_AUDIO_URL_TTL_SECONDS = 86400;

const getRatingLabel = (score: number): string => {
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Good';
  if (score >= 5) return 'Average';
  return 'Needs Improvement';
};

const avg = (arr: (number | null)[]): number => {
  const valid = arr.filter((n) => n !== null) as number[];
  return valid.length
    ? parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1))
    : 0;
};

const toStringArray = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return value
        .split(/[,;\n|]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const getFreshAudioUrl = async (upload: any): Promise<string | null> => {
  if (!upload) return null;
  if (!upload.storagePath) return upload.fileUrl ?? null;

  const { data, error } = await supabase.storage
    .from('audio-uploads')
    .createSignedUrl(upload.storagePath, SIGNED_AUDIO_URL_TTL_SECONDS);

  if (error) {
    logger.warn(
      `Could not refresh signed audio URL for upload ${upload.id}: ${error.message}`
    );
    return upload.fileUrl ?? null;
  }

  return data.signedUrl;
};

const scoringModeLabel = (llmProvider?: string | null, scorerBackend?: string | null) => {
  if (llmProvider === 'heuristic_fallback' || scorerBackend === 'local_semantic') {
    return 'heuristic mode';
  }
  if (scorerBackend === 'transformer') {
    return 'AI model';
  }
  if (scorerBackend === 'skipped') {
    return 'rubric only';
  }
  return llmProvider ? 'AI model' : null;
};

const bucketScore = (score: number | null | undefined, isHeuristic: boolean) => {
  if (score == null) return null;
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return null;
  if (!isHeuristic) return numericScore;
  return Math.round(numericScore * 2) / 2;
};

const mapPipelineResultToAnalysis = (mlResult: any) => {
  const content = mlResult?.content_scores ?? {};
  const delivery = mlResult?.delivery_scores ?? {};
  const audio = mlResult?.audio_metrics ?? {};
  const llmProvider = mlResult?.llm_provider ?? mlResult?.llm_evaluation?.provider ?? null;
  const scorerBackend =
    mlResult?.scorer_backend ??
    mlResult?.content_model_evaluation?.scorer_backend ??
    null;
  const hasAudio = Boolean(audio.audio_available);
  const scoringMode = scoringModeLabel(llmProvider, scorerBackend);
  const isHeuristic =
    llmProvider === 'heuristic_fallback' || scorerBackend === 'local_semantic';
  const fluencyScore = hasAudio
    ? bucketScore(delivery.fluency, isHeuristic)
    : null;
  const confidenceScore = hasAudio
    ? bucketScore(delivery.confidence_cues, isHeuristic)
    : null;
  const pronunciationScore = hasAudio
    ? bucketScore(delivery.articulation, isHeuristic)
    : null;
  const hesitationControlScore = bucketScore(delivery.hesitation_control, isHeuristic);
  const voiceQualityScore = bucketScore(delivery.voice_quality, isHeuristic);
  const wordsPerMinute = Number(audio.words_per_minute);
  const hasUsablePace =
    hasAudio &&
    Number.isFinite(wordsPerMinute) &&
    wordsPerMinute > 0;
  const improvements = Array.isArray(mlResult?.improvements)
    ? mlResult.improvements
    : [];
  const metricFeedback = [];

  if (hasAudio) {
    if (hasUsablePace) {
      metricFeedback.push(`Speaking speed: ${Math.round(wordsPerMinute)} WPM`);
    }
    if (audio.pause_count != null) {
      metricFeedback.push(
        `Pause analysis: ${audio.pause_count} pause(s), ${audio.long_pause_count ?? 0} long pause(s)`
      );
    }
    if (audio.filler_count != null) {
      metricFeedback.push(`Filler analysis: ${audio.filler_count} filler word(s) detected`);
    }
    if (hesitationControlScore != null) {
      metricFeedback.push(`Hesitation control: ${hesitationControlScore.toFixed(1)}/10`);
    }
    if (voiceQualityScore != null) {
      metricFeedback.push(`Voice quality/confidence cues: ${voiceQualityScore.toFixed(1)}/10`);
    }
  } else {
    metricFeedback.push(
      'Delivery timing needs recorded audio; transcript-only analysis cannot measure real pauses or voice quality.'
    );
  }

  return {
    clarityScore: content.clarity ?? null,
    fluencyScore,
    confidenceScore,
    relevanceScore: content.relevance ?? null,
    grammarScore: content.correctness ?? null,
    pronunciationScore,
    technicalScore:
      content.correctness != null && content.completeness != null
        ? parseFloat(((content.correctness + content.completeness) / 2).toFixed(1))
        : content.correctness ?? null,
    fillerWordCount: audio.filler_count ?? null,
    speechRateWpm: hasUsablePace ? Math.round(wordsPerMinute) : null,
    sentiment: mlResult?.label === 'STRONG' ? 'positive' : 'neutral',
    overallScore: mlResult?.overall_score ?? null,
    llmProvider,
    scorerBackend,
    feedbackJson: [
      scoringMode ? `Scoring mode: ${scoringMode}` : null,
      mlResult?.feedback,
      ...improvements,
      ...metricFeedback,
    ].filter(Boolean),
  };
};

export const getProcessingStatus = async (
  userId: string,
  sessionId: string
) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  const responses = await prisma.response.findMany({
    where: { sessionId },
    include: { analysis: true },
  });

  const report = await prisma.report.findUnique({ where: { sessionId } });

  const totalQuestions = session.questionCount;
  const uploadedCount = responses.length;
  const transcribedCount = responses.filter((r) => r.transcript).length;
  const analyzedCount = responses.filter((r) => r.analysis).length;

  const stages = [
    {
      stage: 'upload',
      status: uploadedCount > 0 ? 'completed' : 'pending',
      label: 'Audio uploaded',
    },
    {
      stage: 'transcription',
      status:
        transcribedCount === totalQuestions
          ? 'completed'
          : transcribedCount > 0
            ? 'in_progress'
            : 'pending',
      label: 'Generating transcript',
    },
    {
      stage: 'analysis',
      status:
        analyzedCount === totalQuestions
          ? 'completed'
          : analyzedCount > 0
            ? 'in_progress'
            : 'pending',
      label: 'Running AI analysis',
    },
    {
      stage: 'report',
      status: report ? 'completed' : 'pending',
      label: 'Preparing summary',
    },
  ];

  const progress = Math.round(
    ((uploadedCount +
      transcribedCount +
      analyzedCount +
      (report ? totalQuestions : 0)) /
      (totalQuestions * 4)) *
      100
  );

  return {
    stages,
    progress: Math.min(progress, 100),
    completed: session.status === 'COMPLETED',
  };
};

export const getQuestionSummary = async (
  userId: string,
  sessionId: string,
  questionId: string
) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  const response = await prisma.response.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
    include: { analysis: true },
  });
  if (!response) throw new ApiError('NOT_FOUND', 'Response not found.', 404);

  return {
    responseId: response.id,
    transcript: response.transcript,
    analysis: response.analysis
      ? {
          clarityScore: response.analysis.clarityScore,
          fluencyScore: response.analysis.fluencyScore,
          confidenceScore: response.analysis.confidenceScore,
          relevanceScore: response.analysis.relevanceScore,
          grammarScore: response.analysis.grammarScore,
          pronunciationScore: response.analysis.pronunciationScore,
          technicalScore: response.analysis.technicalScore,
          fillerWordCount: response.analysis.fillerWordCount,
          speechRateWpm: response.analysis.speechRateWpm,
          overallScore: response.analysis.overallScore,
          llmProvider: response.analysis.llmProvider,
          scorerBackend: response.analysis.scorerBackend,
          feedback: response.analysis.feedbackJson,
        }
      : null,
  };
};

export const getSessionAnalysis = async (userId: string, sessionId: string) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: { report: true },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);
  if (!session.report)
    throw new ApiError('NOT_READY', 'Analysis not ready yet.', 404);

  return {
    sessionId,
    overallScore: session.report.overallScore,
    ratingLabel: session.report.ratingLabel,
    summary: session.report.summary,
    strengths: session.report.strengthsJson,
    weaknesses: session.report.weaknessesJson,
    recommendations: session.report.recommendationsJson,
  };
};

export const getSessionReview = async (userId: string, sessionId: string) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      report: true,
      responses: {
        include: {
          question: true,
          analysis: true,
        },
      },
    },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  const duration = session.endedAt
    ? Math.round(
        (session.endedAt.getTime() - session.startedAt.getTime()) / 1000
      )
    : null;

  return {
    session: {
      id: session.id,
      title: session.title,
      date: session.startedAt,
      duration,
      score: session.overallScore,
    },
    questions: session.responses.map((r) => ({
      id: r.question.id,
      content: r.question.content,
      transcript: r.transcript,
      notes: r.notes,
      score: r.analysis?.overallScore ?? null,
      llmProvider: r.analysis?.llmProvider ?? null,
      scorerBackend: r.analysis?.scorerBackend ?? null,
      scoringMode: scoringModeLabel(
        r.analysis?.llmProvider,
        r.analysis?.scorerBackend
      ),
      feedback: r.analysis?.feedbackJson ?? null,
    })),
  };
};

export const generateSessionAnalysis = async (
  userId: string,
  sessionId: string
) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      responses: {
        include: {
          question: true,
          uploads: {
            where: { type: 'AUDIO' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  for (const response of session.responses) {
    // Skip analysis entirely for questions the user skipped
    const isSkipped =
      !response.transcript ||
      response.transcript.trim() === '[skipped]' ||
      response.transcript.trim() === '';

    if (isSkipped) {
      // Remove any stale analysis from a previous attempt
      await prisma.responseAnalysis.deleteMany({
        where: { responseId: response.id },
      });
      continue;
    }

    let analysisData: any = {
      clarityScore: null,
      fluencyScore: null,
      confidenceScore: null,
      relevanceScore: null,
      grammarScore: null,
      pronunciationScore: null,
      technicalScore: null,
      fillerWordCount: null,
      speechRateWpm: null,
      sentiment: 'neutral',
      overallScore: null,
      llmProvider: null,
      scorerBackend: 'fallback_mock',
      feedbackJson: [
        'Fallback analysis: ML services unavailable; these scores are provisional.',
      ],
    };

    const audioUrl = await getFreshAudioUrl(response.uploads?.[0] ?? null);

    // Use real ML when either a transcript or the original audio is available.
    if (response.transcript || audioUrl) {
      logger.info(`Using new evaluator pipeline for response: ${response.id}`);
      const { expectedKeywords, expectedKeyPoints, referenceAnswer } =
        buildEvaluationRubric(response.question, session.targetRole);

      const pipelineResult = await analyzeAnswerPipeline({
        responseId: response.id,
        userId,
        questionId: response.questionId,
        questionText: response.question.content,
        transcript: response.transcript || '',
        audioUrl,
        expectedKeywords,
        expectedKeyPoints,
        idealAnswer: referenceAnswer,
      });

      if (pipelineResult) {
        analysisData = mapPipelineResultToAnalysis(pipelineResult);
      } else {
        logger.warn(`New evaluator failed, falling back to transcript analyzer for response: ${response.id}`);
        const mlResult = await analyzeResponse(response.id, response.transcript || '', {
          questionText: response.question.content,
          audioUrl,
          expectedKeywords,
          expectedKeyPoints,
          idealAnswer: referenceAnswer,
        });
        if (mlResult) {
          analysisData = {
            clarityScore: mlResult.clarityScore,
            fluencyScore: mlResult.fluencyScore,
            confidenceScore: mlResult.confidenceScore,
            relevanceScore: mlResult.relevanceScore,
            grammarScore: mlResult.grammarScore,
            pronunciationScore: mlResult.pronunciationScore,
            technicalScore: mlResult.technicalScore,
            fillerWordCount: mlResult.fillerWordCount,
            speechRateWpm: mlResult.speechRateWpm,
            sentiment: mlResult.sentiment,
            overallScore: mlResult.overallScore,
            llmProvider: mlResult.llmProvider ?? null,
            scorerBackend: mlResult.scorerBackend ?? null,
            feedbackJson: mlResult.feedbackJson,
          };
        } else {
          logger.warn(
            `Both ML analyzers failed for response ${response.id}; using fallback analysis scores`
          );
        }
      }
    }

    await prisma.responseAnalysis.upsert({
      where: { responseId: response.id },
      update: analysisData,
      create: { responseId: response.id, ...analysisData },
    });
  }

  // Generate report
  const analyses = await prisma.responseAnalysis.findMany({
    where: { response: { sessionId } },
  });

  const scoredAnalyses = analyses.filter((a) => a.overallScore !== null);
  const overallScore = scoredAnalyses.length > 0
    ? parseFloat(avg(scoredAnalyses.map((a) => a.overallScore)).toFixed(1))
    : 0;

  await prisma.report.upsert({
    where: { sessionId },
    update: {
      overallScore,
      ratingLabel: getRatingLabel(overallScore),
      summary: 'AI-powered analysis of your interview performance.',
      strengthsJson: ['Clear communication', 'Good answer structure'],
      weaknessesJson: ['Technical depth', 'Filler words'],
      recommendationsJson: [
        'Practice concise answers',
        'Use measurable examples',
      ],
      radarDataJson: {
        labels: [
          'Communication',
          'Confidence',
          'Technical',
          'Clarity',
          'Fluency',
        ],
        values: [
          avg(scoredAnalyses.map((a) => a.relevanceScore)),
          avg(scoredAnalyses.map((a) => a.confidenceScore)),
          avg(scoredAnalyses.map((a) => a.technicalScore)),
          avg(scoredAnalyses.map((a) => a.clarityScore)),
          avg(scoredAnalyses.map((a) => a.fluencyScore)),
        ],
      },
    },
    create: {
      sessionId,
      overallScore,
      ratingLabel: getRatingLabel(overallScore),
      summary: 'AI-powered analysis of your interview performance.',
      strengthsJson: ['Clear communication', 'Good answer structure'],
      weaknessesJson: ['Technical depth', 'Filler words'],
      recommendationsJson: [
        'Practice concise answers',
        'Use measurable examples',
      ],
      radarDataJson: {
        labels: [
          'Communication',
          'Confidence',
          'Technical',
          'Clarity',
          'Fluency',
        ],
        values: [
          avg(scoredAnalyses.map((a) => a.relevanceScore)),
          avg(scoredAnalyses.map((a) => a.confidenceScore)),
          avg(scoredAnalyses.map((a) => a.technicalScore)),
          avg(scoredAnalyses.map((a) => a.clarityScore)),
          avg(scoredAnalyses.map((a) => a.fluencyScore)),
        ],
      },
    },
  });

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: 'COMPLETED', overallScore },
  });

  // Update practice streak
  await updateStreak(userId);

  // Capture skill snapshot for timeline analytics
  await captureSkillSnapshot(userId, sessionId);

  return { success: true, message: 'Analysis complete' };
};
