import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { submitFeedback, getQuestionFeedbackStats, getUserRatingForQuestion } from './questionFeedback.service';
import { sendSuccess } from '../../utils/apiResponse';
import { ApiError } from '../../utils/apiError';

const router = Router();

const VALID_RATINGS = ['TOO_EASY', 'JUST_RIGHT', 'TOO_HARD'];

// POST /api/sessions/:sessionId/questions/:questionId/feedback
router.post(
  '/sessions/:sessionId/questions/:questionId/feedback',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      const { sessionId, questionId } = req.params;
      const { difficultyRating } = req.body;

      if (!VALID_RATINGS.includes(difficultyRating)) {
        throw new ApiError('VALIDATION_ERROR', 'Invalid difficulty rating.', 400);
      }

      const result = await submitFeedback(
        req.user.id,
        questionId,
        sessionId,
        difficultyRating
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/questions/:questionId/feedback-stats
router.get(
  '/questions/:questionId/feedback-stats',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      const result = await getQuestionFeedbackStats(req.params.questionId);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sessions/:sessionId/questions/:questionId/my-rating
router.get(
  '/sessions/:sessionId/questions/:questionId/my-rating',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      const { sessionId, questionId } = req.params;
      const rating = await getUserRatingForQuestion(req.user.id, questionId, sessionId);
      return sendSuccess(res, { rating });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
