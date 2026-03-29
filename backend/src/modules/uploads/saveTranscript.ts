import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

export const saveTranscript = async (
  userId: string,
  sessionId: string,
  questionId: string,
  transcript: string,
  answerOrder: number,
  durationSeconds?: number
) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });
  if (!question) throw new ApiError('NOT_FOUND', 'Question not found.', 404);

  // Create or update Response with transcript
  const existing = await prisma.response.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
  });

  let response;
  if (existing) {
    response = await prisma.response.update({
      where: { id: existing.id },
      data: { transcript, durationSeconds, answerOrder },
    });
  } else {
    response = await prisma.response.create({
      data: {
        sessionId,
        questionId,
        transcript,
        answerOrder,
        durationSeconds,
      },
    });
  }

  return { success: true, responseId: response.id };
};
