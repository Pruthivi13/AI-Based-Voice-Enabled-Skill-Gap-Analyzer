import { Router } from 'express';
import multer from 'multer';
import {
  uploadAudio,
  getTranscript,
  saveTranscriptHandler,
} from './uploads.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { strictRateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/sessions/:id/questions/:qid/audio',
  authMiddleware,
  strictRateLimit,
  upload.single('audio'),
  uploadAudio
);

router.get(
  '/sessions/:id/questions/:qid/transcript',
  authMiddleware,
  getTranscript
);

router.post(
  '/sessions/:id/questions/:qid/transcript',
  authMiddleware,
  saveTranscriptHandler
);

export default router;
