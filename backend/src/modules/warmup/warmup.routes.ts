import { Router } from 'express';
import { getWarmupQuestion } from './warmup.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/warmup/question', authMiddleware, getWarmupQuestion);

export default router;
