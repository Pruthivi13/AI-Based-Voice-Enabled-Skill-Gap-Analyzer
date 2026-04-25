import prisma from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { enqueueSessionJobs, removeSessionJobs } from './scheduler';
import { logger } from '../utils/logger';

/**
 * Schedule an interview session for a future time.
 * Enqueues pg-boss jobs for activation + reminder email.
 */
export async function scheduleSession(
  userId: string,
  payload: {
    interviewType: string;
    targetRole: string;
    difficulty: string;
    experienceLevel?: string;
    questionCount: number;
    scheduledAt: string; // ISO timestamp
    title?: string;
  }
) {
  const scheduledAt = new Date(payload.scheduledAt);
  if (scheduledAt <= new Date()) {
    throw new ApiError('BAD_REQUEST', 'Scheduled time must be in the future.', 400);
  }

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      interviewType:   payload.interviewType as any,
      targetRole:      payload.targetRole,
      difficulty:      payload.difficulty as any,
      experienceLevel: payload.experienceLevel as any,
      questionCount:   payload.questionCount,
      title:           payload.title || `${payload.targetRole} Interview`,
      status:          'SCHEDULED' as any,
      scheduledAt,
    },
  });

  // Fetch user email for reminder
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

  // Enqueue pg-boss jobs (activation at scheduledAt + reminder 15 min before)
  await enqueueSessionJobs({
    sessionId:  session.id,
    userId,
    userEmail:  user?.email ?? '',
    title:      session.title ?? 'Interview',
    scheduledAt,
  });

  logger.info(`Session ${session.id} scheduled for ${scheduledAt.toISOString()}`);
  return session;
}

/**
 * Get upcoming scheduled sessions for a user.
 */
export async function getScheduledSessions(userId: string) {
  const now = new Date();
  return prisma.interviewSession.findMany({
    where: {
      userId,
      status: 'SCHEDULED' as any,
      scheduledAt: { gte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
  });
}

/**
 * Get the next scheduled interview for dashboard display.
 */
export async function getNextScheduledSession(userId: string) {
  const now = new Date();
  return prisma.interviewSession.findFirst({
    where: {
      userId,
      status: 'SCHEDULED' as any,
      scheduledAt: { gte: now },
    },
    orderBy: { scheduledAt: 'asc' },
  });
}

/**
 * Cancel a scheduled session.
 * Removes pg-boss jobs before updating DB.
 */
export async function cancelScheduledSession(userId: string, sessionId: string) {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);
  if ((session.status as string) !== 'SCHEDULED') {
    throw new ApiError('BAD_REQUEST', 'Only scheduled sessions can be cancelled.', 400);
  }

  // Remove pg-boss jobs before updating DB
  await removeSessionJobs(sessionId);

  return prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: 'CANCELLED' as any },
  });
}

/**
 * Reschedule a session to a new time.
 * Removes old pg-boss jobs and enqueues new ones.
 */
export async function rescheduleSession(userId: string, sessionId: string, newTime: string) {
  const scheduledAt = new Date(newTime);
  if (scheduledAt <= new Date()) {
    throw new ApiError('BAD_REQUEST', 'New scheduled time must be in the future.', 400);
  }

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);
  if ((session.status as string) !== 'SCHEDULED') {
    throw new ApiError('BAD_REQUEST', 'Only scheduled sessions can be rescheduled.', 400);
  }

  // Remove old jobs, update DB, enqueue new jobs
  await removeSessionJobs(sessionId);

  const updated = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { scheduledAt },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

  await enqueueSessionJobs({
    sessionId,
    userId,
    userEmail:  user?.email ?? '',
    title:      updated.title ?? 'Interview',
    scheduledAt,
  });

  return updated;
}
