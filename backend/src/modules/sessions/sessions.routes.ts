import { Router } from 'express';
import {
  createSession,
  getSessions,
  getSessionById,
  getSessionQuestions,
  finishSession,
} from './sessions.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { strictRateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

router.post('/sessions', authMiddleware, strictRateLimit, createSession);
router.get('/sessions', authMiddleware, getSessions);
router.get('/sessions/:id', authMiddleware, getSessionById);
router.get('/sessions/:id/questions', authMiddleware, getSessionQuestions);
router.post('/sessions/:id/finish', authMiddleware, finishSession);

export default router;
