import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { analyzeResponse } from '../../services/mlClient.service';
import { logger } from '../../utils/logger';

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
    include: { responses: true },
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

    // Use real ML if transcript exists
    if (response.transcript) {
      logger.info(`Using ML analysis for response: ${response.id}`);
      const mlResult = await analyzeResponse(response.id, response.transcript);
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

  return { success: true, message: 'Analysis complete' };
};
