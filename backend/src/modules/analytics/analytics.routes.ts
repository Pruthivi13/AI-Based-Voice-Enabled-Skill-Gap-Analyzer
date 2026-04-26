import { Router } from 'express';
import { getAnalytics, getWeakSkillPrescription } from './analytics.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/analytics',              authMiddleware, getAnalytics);
router.get('/analytics/prescription', authMiddleware, getWeakSkillPrescription);

export default router;
