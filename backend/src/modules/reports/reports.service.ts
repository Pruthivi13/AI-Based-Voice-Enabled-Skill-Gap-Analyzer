import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

export const getReport = async (userId: string, sessionId: string) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  const report = await prisma.report.findUnique({
    where: { sessionId },
  });
  if (!report) throw new ApiError('NOT_READY', 'Report not ready yet.', 404);

  return {
    sessionId,
    overallScore: report.overallScore,
    ratingLabel: report.ratingLabel,
    summary: report.summary,
    strengths: report.strengthsJson,
    weaknesses: report.weaknessesJson,
    recommendations: report.recommendationsJson,
    radarData: report.radarDataJson,
    createdAt: report.createdAt,
  };
};
