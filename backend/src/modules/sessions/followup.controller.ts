import { Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import prisma from '../../config/prisma';
import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const mlClient = axios.create({ baseURL: env.ML_SERVICE_URL, timeout: 30000 });

export const generateFollowup = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: sessionId } = req.params;
    const { originalQuestion, transcript, targetRole, count = 2, questionId } = req.body;

    // Verify session ownership
    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId: req.user.id },
    });
    if (!session) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Session not found.' });
    }

    if (!transcript || transcript.trim().length < 10) {
      return sendSuccess(res, { followups: [], success: true });
    }

    const { data } = await mlClient.post('/internal/generate-followup', {
      originalQuestion: originalQuestion || '',
      transcript,
      targetRole: targetRole || session.targetRole || 'Software Engineer',
      count: Math.min(Math.max(Number(count) || 2, 1), 2),
    });

    const followups = data.followups ?? [];
    if (followups.length > 0 && questionId) {
      const response = await prisma.response.findUnique({
        where: { sessionId_questionId: { sessionId, questionId } },
      });

      if (response) {
        const followupRows = followups
          .map((followup: any) => ({
            responseId: response.id,
            question: String(followup.question || '').trim(),
            reason: followup.reason ? String(followup.reason).trim() : null,
            topic: followup.topic ? String(followup.topic).trim() : null,
          }))
          .filter((followup: any) => followup.question);

        await prisma.$transaction([
          prisma.followupQuestion.deleteMany({
            where: { responseId: response.id },
          }),
          ...(followupRows.length
            ? [prisma.followupQuestion.createMany({ data: followupRows })]
            : []),
        ]);
      }
    }

    logger.info(`Generated ${followups.length} follow-ups for session ${sessionId}`);
    return sendSuccess(res, { followups, success: true });
  } catch (err) {
    logger.error('Follow-up generation failed:', err);
    // Return empty gracefully — don't crash the interview
    return sendSuccess(res, { followups: [], success: false });
  }
};
