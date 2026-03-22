import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

export const createSession = async (userId: string, data: any) => {
  const {
    interviewType,
    targetRole,
    difficulty,
    experienceLevel,
    questionCount,
    jobDescription,
  } = data;

  // Pick random questions based on type and difficulty
  const category =
    interviewType === 'TECHNICAL'
      ? 'TECHNICAL'
      : interviewType === 'HR'
        ? 'HR'
        : interviewType === 'COMMUNICATION'
          ? 'COMMUNICATION'
          : undefined;

  const questions = await prisma.question.findMany({
    where: {
      isActive: true,
      difficulty,
      ...(category && { category }),
    },
    take: questionCount,
  });

  if (questions.length === 0) {
    throw new ApiError(
      'NO_QUESTIONS',
      'No questions found for this configuration.',
      404
    );
  }

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      interviewType,
      targetRole,
      difficulty,
      experienceLevel,
      questionCount: questions.length,
      jobDescription,
      title: `${targetRole} ${interviewType} Interview`,
    },
  });

  return { sessionId: session.id, status: session.status, questions };
};

export const getSessions = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.interviewSession.count({ where: { userId } }),
  ]);

  return {
    items,
    page,
    limit,
    total,
    hasMore: skip + items.length < total,
  };
};

export const getSessionById = async (userId: string, sessionId: string) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);
  return session;
};

export const getSessionQuestions = async (
  userId: string,
  sessionId: string
) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  const category =
    session.interviewType === 'TECHNICAL'
      ? 'TECHNICAL'
      : session.interviewType === 'HR'
        ? 'HR'
        : session.interviewType === 'COMMUNICATION'
          ? 'COMMUNICATION'
          : undefined;

  const questions = await prisma.question.findMany({
    where: {
      isActive: true,
      difficulty: session.difficulty,
      ...(category && { category }),
    },
    take: session.questionCount,
    select: {
      id: true,
      content: true,
      category: true,
      difficulty: true,
      timeLimitSeconds: true,
    },
  });

  return questions;
};

export const finishSession = async (userId: string, sessionId: string) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  const updated = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: 'PROCESSING', endedAt: new Date() },
  });

  return { success: true, status: updated.status };
};
