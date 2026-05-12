import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { strictRateLimit } from '../../middleware/rateLimit.middleware';
import { generateFollowup } from './followup.controller';

const router = Router();

router.post('/sessions/:id/followup', authMiddleware, strictRateLimit, generateFollowup);

export default router;
