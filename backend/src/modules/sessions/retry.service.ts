import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

export const retryQuestion = async (
  userId: string,
  sessionId: string,
  questionId: string
) => {
  // Verify session ownership
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  // Verify question exists
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });
  if (!question) throw new ApiError('NOT_FOUND', 'Question not found.', 404);

  // Delete existing response + analysis (cascade handles analysis)
  const existing = await prisma.response.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
  });

  if (existing) {
    await prisma.response.delete({ where: { id: existing.id } });
  }

  // Reset session status back to IN_PROGRESS
  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: 'IN_PROGRESS', overallScore: null },
  });

  // Delete old report so it gets regenerated
  await prisma.report.deleteMany({ where: { sessionId } });

  return {
    success: true,
    question: {
      id: question.id,
      content: question.content,
      category: question.category,
      difficulty: question.difficulty,
      timeLimitSeconds: question.timeLimitSeconds,
    },
  };
};
