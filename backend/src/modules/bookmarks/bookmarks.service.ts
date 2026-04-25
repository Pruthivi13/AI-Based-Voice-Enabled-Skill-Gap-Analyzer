import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

// ─── Toggle bookmark (add if missing, remove if present) ─────────────────────
export const toggleBookmark = async (
  userId: string,
  questionId: string,
  note?: string
): Promise<{ bookmarked: boolean; id?: string }> => {
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new ApiError('NOT_FOUND', 'Question not found.', 404);

  const existing = await (prisma as any).bookmarkedQuestion.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });

  if (existing) {
    await (prisma as any).bookmarkedQuestion.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  }

  const bookmark = await (prisma as any).bookmarkedQuestion.create({
    data: { userId, questionId, note: note ?? null },
  });
  return { bookmarked: true, id: bookmark.id };
};

// ─── Update note on an existing bookmark ─────────────────────────────────────
export const updateBookmarkNote = async (
  userId: string,
  questionId: string,
  note: string
) => {
  const existing = await (prisma as any).bookmarkedQuestion.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });
  if (!existing) throw new ApiError('NOT_FOUND', 'Bookmark not found.', 404);

  return (prisma as any).bookmarkedQuestion.update({
    where: { id: existing.id },
    data: { note },
  });
};

// ─── Get all bookmarks for a user ─────────────────────────────────────────────
export const getBookmarks = async (userId: string) => {
  const bookmarks = await (prisma as any).bookmarkedQuestion.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      question: {
        select: {
          id: true,
          content: true,
          category: true,
          difficulty: true,
          timeLimitSeconds: true,
          hints: true,
          role: true,
        },
      },
    },
  });

  return bookmarks.map((b: any) => ({
    bookmarkId: b.id,
    note: b.note,
    bookmarkedAt: b.createdAt,
    question: b.question,
  }));
};

// ─── Check bookmark status for a list of question IDs ────────────────────────
export const getBookmarkStatus = async (
  userId: string,
  questionIds: string[]
): Promise<Record<string, boolean>> => {
  const found = await (prisma as any).bookmarkedQuestion.findMany({
    where: { userId, questionId: { in: questionIds } },
    select: { questionId: true },
  });
  const set = new Set(found.map((b: any) => b.questionId));
  return Object.fromEntries(questionIds.map((id) => [id, set.has(id)]));
};

// ─── Delete a bookmark by bookmarkId ─────────────────────────────────────────
export const deleteBookmark = async (userId: string, bookmarkId: string) => {
  const existing = await (prisma as any).bookmarkedQuestion.findFirst({
    where: { id: bookmarkId, userId },
  });
  if (!existing) throw new ApiError('NOT_FOUND', 'Bookmark not found.', 404);
  await (prisma as any).bookmarkedQuestion.delete({ where: { id: bookmarkId } });
  return { success: true };
};
