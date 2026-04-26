import { Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

export const saveNote = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id: sessionId, qid: questionId } = req.params;
    const { notes } = req.body;

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId: req.user.id },
    });
    if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

    const existing = await prisma.response.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
    });

    let updated;
    if (existing) {
      updated = await prisma.response.update({
        where: { id: existing.id },
        data: { notes: notes ?? null },
      });
    } else {
      updated = await prisma.response.create({
        data: {
          sessionId,
          questionId,
          notes: notes ?? null,
          answerOrder: 0,
        },
      });
    }

    return sendSuccess(res, { notes: updated.notes });
  } catch (err) {
    next(err);
  }
};

export const getNote = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id: sessionId, qid: questionId } = req.params;

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId: req.user.id },
    });
    if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

    const response = await prisma.response.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
      select: { notes: true },
    });

    return sendSuccess(res, { notes: response?.notes ?? null });
  } catch (err) {
    next(err);
  }
};
