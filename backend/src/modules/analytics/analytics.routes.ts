import { Router } from 'express';
import { getAnalytics } from './analytics.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/analytics', authMiddleware, getAnalytics);

export default router;
