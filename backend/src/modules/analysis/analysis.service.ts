import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import {
  analyzeAnswerPipeline,
  analyzeResponse,
} from '../../services/mlClient.service';
import { logger } from '../../utils/logger';
import { updateStreak } from '../../services/streak.service';
import { captureSkillSnapshot } from '../../services/skillSnapshot.service';

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

const mapPipelineResultToAnalysis = (mlResult: any) => {
  const content = mlResult?.content_scores ?? {};
  const delivery = mlResult?.delivery_scores ?? {};
  const audio = mlResult?.audio_metrics ?? {};
  const wordsPerMinute = Number(audio.words_per_minute);
  const hasUsablePace =
    Boolean(audio.audio_available) &&
    Number.isFinite(wordsPerMinute) &&
    wordsPerMinute > 0;
  const improvements = Array.isArray(mlResult?.improvements)
    ? mlResult.improvements
    : [];
  const metricFeedback = [];

  if (audio.audio_available) {
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
    if (delivery.hesitation_control != null) {
      metricFeedback.push(`Hesitation control: ${Number(delivery.hesitation_control).toFixed(1)}/10`);
    }
    if (delivery.voice_quality != null) {
      metricFeedback.push(`Voice quality/confidence cues: ${Number(delivery.voice_quality).toFixed(1)}/10`);
    }
  } else {
    metricFeedback.push(
      'Delivery timing needs recorded audio; transcript-only analysis cannot measure real pauses or voice quality.'
    );
  }

  return {
    clarityScore: content.clarity ?? null,
    fluencyScore: delivery.fluency ?? null,
    confidenceScore: delivery.confidence_cues ?? null,
    relevanceScore: content.relevance ?? null,
    grammarScore: content.clarity ?? null,
    pronunciationScore: delivery.voice_quality ?? delivery.delivery ?? null,
    technicalScore:
      content.correctness != null && content.completeness != null
        ? parseFloat(((content.correctness + content.completeness) / 2).toFixed(1))
        : content.correctness ?? null,
    fillerWordCount: audio.filler_count ?? null,
    speechRateWpm: hasUsablePace ? Math.round(wordsPerMinute) : null,
    sentiment: mlResult?.label === 'STRONG' ? 'positive' : 'neutral',
    overallScore: mlResult?.overall_score ?? null,
    feedbackJson: [
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
      feedback: r.analysis?.feedbackJson ?? null,
    })),
  };
};

export const generateMockAnalysis = async (
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
    let analysisData: any = {
      clarityScore: 7.5,
      fluencyScore: 7.2,
      confidenceScore: 7.0,
      relevanceScore: 7.8,
      grammarScore: 7.4,
      pronunciationScore: 7.1,
      technicalScore: 7.6,
      fillerWordCount: 5,
      speechRateWpm: 130,
      sentiment: 'positive',
      overallScore: 7.4,
      feedbackJson: [
        'Good structure',
        'Add more examples',
        'Reduce filler words',
      ],
    };

    const audioUrl = response.uploads?.[0]?.fileUrl ?? null;

    // Use real ML when either a transcript or the original audio is available.
    if (response.transcript || audioUrl) {
      logger.info(`Using new evaluator pipeline for response: ${response.id}`);
      const expectedKeywords = toStringArray(response.question.expectedKeywords);
      const referenceAnswer = response.question.referenceAnswer || '';
      const expectedKeyPoints = referenceAnswer ? [referenceAnswer] : [];

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
            feedbackJson: mlResult.feedbackJson,
          };
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

  const overallScore = parseFloat(
    avg(analyses.map((a) => a.overallScore)).toFixed(1)
  );

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
          avg(analyses.map((a) => a.clarityScore)),
          avg(analyses.map((a) => a.confidenceScore)),
          avg(analyses.map((a) => a.technicalScore)),
          avg(analyses.map((a) => a.clarityScore)),
          avg(analyses.map((a) => a.fluencyScore)),
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
          avg(analyses.map((a) => a.clarityScore)),
          avg(analyses.map((a) => a.confidenceScore)),
          avg(analyses.map((a) => a.technicalScore)),
          avg(analyses.map((a) => a.clarityScore)),
          avg(analyses.map((a) => a.fluencyScore)),
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
