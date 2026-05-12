import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

export const getAllQuestions = async (
  category?: string,
  difficulty?: string
) => {
  return prisma.question.findMany({
    where: {
      isActive: true,
      ...(category && { category: category as any }),
      ...(difficulty && { difficulty: difficulty as any }),
    },
    select: {
      id: true,
      content: true,
      category: true,
      role: true,
      difficulty: true,
      expectedKeywords: true,
      timeLimitSeconds: true,
      hints: true,
      referenceAnswer: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getQuestionById = async (id: string) => {
  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) throw new ApiError('NOT_FOUND', 'Question not found.', 404);
  return question;
};
