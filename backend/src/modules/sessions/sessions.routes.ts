import { Router } from 'express';
import multer from 'multer';
import {
  createSession,
  getSessions,
  getSessionById,
  getSessionQuestions,
  finishSession,
  retryQuestion,
  createSessionWithResume,
} from './sessions.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { strictRateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

router.post(
  '/sessions/with-resume',
  authMiddleware,
  upload.single('resume'),
  createSessionWithResume
);
router.post('/sessions', authMiddleware, strictRateLimit, createSession);
router.get('/sessions', authMiddleware, getSessions);
router.get('/sessions/:id', authMiddleware, getSessionById);
router.get('/sessions/:id/questions', authMiddleware, getSessionQuestions);
router.post('/sessions/:id/finish', authMiddleware, finishSession);
router.post(
  '/sessions/:id/questions/:qid/retry',
  authMiddleware,
  retryQuestion
);

export default router;
