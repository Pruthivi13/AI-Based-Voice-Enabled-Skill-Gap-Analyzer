import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { fetchCoursesFromML } from '../../services/courseRecommender.service';
import { logger } from '../../utils/logger';

/**
 * Get (or generate + cache) course recommendations for a session.
 * If courses already exist in DB, return them instantly.
 * Otherwise fetch from ML service, persist, and return.
 */
export const getCourseRecommendations = async (
  userId: string,
  sessionId: string,
  forceRefresh: boolean = false
) => {
  // Verify session ownership
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, targetRole: true },
  });
  if (!session) {
    throw new ApiError('NOT_FOUND', 'Session not found.', 404);
  }

  if (!forceRefresh) {
    // Return cached courses if they exist
    const existing = await (prisma as any).courseRecommendation.findUnique({
      where: { sessionId },
    });
    if (existing && Array.isArray(existing.coursesJson) && existing.coursesJson.length > 0) {
      logger.info(`Returning cached courses for session: ${sessionId}`);
      return {
        sessionId,
        targetRole: existing.targetRole,
        courses: existing.coursesJson,
      };
    }
  }

  // Fetch fresh from ML / Serper
  logger.info(`Generating courses for role: ${session.targetRole}`);
  const courses = await fetchCoursesFromML(session.targetRole);

  if (courses.length === 0) {
    // Return empty but valid response — don't crash
    return { sessionId, targetRole: session.targetRole, courses: [] };
  }

  // Persist so history page can retrieve them instantly
  await (prisma as any).courseRecommendation.upsert({
    where: { sessionId },
    update: { coursesJson: courses as any, targetRole: session.targetRole },
    create: {
      sessionId,
      targetRole: session.targetRole,
      coursesJson: courses as any,
    },
  });

  return { sessionId, targetRole: session.targetRole, courses };
};
