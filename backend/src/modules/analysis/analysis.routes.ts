import { Router } from 'express';
import {
  getProcessingStatus,
  getQuestionSummary,
  getSessionAnalysis,
  getSessionReview,
  generateAnalysis,
} from './analysis.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get(
  '/sessions/:id/processing-status',
  authMiddleware,
  getProcessingStatus
);
router.get(
  '/sessions/:id/questions/:qid/summary',
  authMiddleware,
  getQuestionSummary
);
router.get('/sessions/:id/analysis', authMiddleware, getSessionAnalysis);
router.get('/sessions/:id/review', authMiddleware, getSessionReview);
router.post(
  '/sessions/:id/generate-analysis',
  authMiddleware,
  generateAnalysis
);

export default router;
