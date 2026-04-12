import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { generateFollowup } from './followup.controller';

const router = Router();

router.post('/sessions/:id/followup', authMiddleware, generateFollowup);

export default router;
