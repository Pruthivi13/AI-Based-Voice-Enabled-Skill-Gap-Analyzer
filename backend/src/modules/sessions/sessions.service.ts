import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { generateQuestionsFromAI } from '../../services/questionGenerator.service';
import { logger } from '../../utils/logger';

export const createSession = async (userId: string, data: any) => {
  const {
    interviewType,
    targetRole,
    difficulty,
    experienceLevel,
    questionCount,
    jobDescription,
  } = data;

  let questions;

  try {
    // 🚀 Try AI first (NO retry, clean & fast)
    questions = await generateQuestionsFromAI(
      targetRole,
      experienceLevel || 'JUNIOR',
      interviewType,
      questionCount
    );
  } catch (err) {
    // 🛟 Fallback to DB if AI fails
    logger.warn('AI generation failed, falling back to DB questions');

    const category =
      interviewType === 'TECHNICAL'
        ? 'TECHNICAL'
        : interviewType === 'HR'
          ? 'HR'
          : interviewType === 'COMMUNICATION'
            ? 'COMMUNICATION'
            : undefined;

    questions = await prisma.question.findMany({
      where: {
        isActive: true,
        difficulty,
        ...(category && { category }),
      },
      take: questionCount,
    });
  }

  // ❌ No questions at all
  if (!questions || questions.length === 0) {
    throw new ApiError('NO_QUESTIONS', 'No questions found.', 404);
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

// ─────────────────────────────────────────

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
