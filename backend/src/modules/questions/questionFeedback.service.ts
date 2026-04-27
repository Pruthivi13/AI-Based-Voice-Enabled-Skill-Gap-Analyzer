import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

type DifficultyRating = 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD';

const RECALIBRATION_THRESHOLD = 20; // recalculate after N ratings

/**
 * Recalculates adjustedDifficulty based on crowd-sourced ratings.
 * Logic:
 *   If >50% say TOO_EASY  → bump down one level
 *   If >50% say TOO_HARD  → bump up one level
 *   Otherwise             → keep original
 */
async function recalculateAdjustedDifficulty(questionId: string) {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      difficulty: true,
      tooEasyCount: true,
      justRightCount: true,
      tooHardCount: true,
    },
  });
  if (!q) return;

  const total = q.tooEasyCount + q.justRightCount + q.tooHardCount;
  if (total < RECALIBRATION_THRESHOLD) return; // not enough data yet

  const easyPct = q.tooEasyCount / total;
  const hardPct = q.tooHardCount / total;

  const difficultyLevels = ['EASY', 'MEDIUM', 'HARD'];
  const currentIdx = difficultyLevels.indexOf(q.difficulty);

  let adjusted = q.difficulty;
  if (easyPct > 0.5 && currentIdx > 0) {
    adjusted = difficultyLevels[currentIdx - 1] as any;
  } else if (hardPct > 0.5 && currentIdx < 2) {
    adjusted = difficultyLevels[currentIdx + 1] as any;
  }

  await prisma.question.update({
    where: { id: questionId },
    data: { adjustedDifficulty: adjusted },
  });
}

export const submitFeedback = async (
  userId: string,
  questionId: string,
  sessionId: string,
  difficultyRating: DifficultyRating
) => {
  // Verify question exists
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new ApiError('NOT_FOUND', 'Question not found.', 404);

  // Upsert feedback (allow changing mind within same session)
  const existing = await (prisma as any).questionFeedback.findUnique({
    where: { userId_questionId_sessionId: { userId, questionId, sessionId } },
  });

  // Adjust counters
  const counterMap: Record<DifficultyRating, string> = {
    TOO_EASY:   'tooEasyCount',
    JUST_RIGHT: 'justRightCount',
    TOO_HARD:   'tooHardCount',
  };

  if (existing) {
    // Decrement old rating, increment new one
    const oldCounter = counterMap[existing.difficultyRating as DifficultyRating];
    const newCounter = counterMap[difficultyRating];

    if (oldCounter !== newCounter) {
      await prisma.question.update({
        where: { id: questionId },
        data: {
          [oldCounter]: { decrement: 1 },
          [newCounter]: { increment: 1 },
        },
      });
    }

    await (prisma as any).questionFeedback.update({
      where: { id: existing.id },
      data: { difficultyRating },
    });
  } else {
    const newCounter = counterMap[difficultyRating];
    await Promise.all([
      (prisma as any).questionFeedback.create({
        data: { userId, questionId, sessionId, difficultyRating },
      }),
      prisma.question.update({
        where: { id: questionId },
        data: { [newCounter]: { increment: 1 } },
      }),
    ]);
  }

  // Async recalibration — don't block the response
  recalculateAdjustedDifficulty(questionId).catch(console.error);

  // Return updated counts for immediate UI feedback
  const updated = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      tooEasyCount: true,
      justRightCount: true,
      tooHardCount: true,
      adjustedDifficulty: true,
    },
  });

  return {
    success: true,
    yourRating: difficultyRating,
    stats: updated,
  };
};

export const getQuestionFeedbackStats = async (questionId: string) => {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      tooEasyCount: true,
      justRightCount: true,
      tooHardCount: true,
      adjustedDifficulty: true,
      difficulty: true,
    },
  });
  if (!q) throw new ApiError('NOT_FOUND', 'Question not found.', 404);

  const total = q.tooEasyCount + q.justRightCount + q.tooHardCount;
  return {
    ...q,
    total,
    percentages: total > 0 ? {
      tooEasy:   Math.round((q.tooEasyCount / total) * 100),
      justRight: Math.round((q.justRightCount / total) * 100),
      tooHard:   Math.round((q.tooHardCount / total) * 100),
    } : null,
  };
};

export const getUserRatingForQuestion = async (
  userId: string,
  questionId: string,
  sessionId: string
): Promise<DifficultyRating | null> => {
  const fb = await (prisma as any).questionFeedback.findUnique({
    where: { userId_questionId_sessionId: { userId, questionId, sessionId } },
    select: { difficultyRating: true },
  });
  return fb?.difficultyRating ?? null;
};
