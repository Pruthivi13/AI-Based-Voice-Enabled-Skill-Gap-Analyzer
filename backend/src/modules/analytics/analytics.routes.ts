import { Router } from 'express';
import {
  getAnalytics,
  getWeakSkillPrescription,
  getRoleProgressController,
} from './analytics.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/analytics',               authMiddleware, getAnalytics);
router.get('/analytics/prescription',  authMiddleware, getWeakSkillPrescription);
router.get('/analytics/role-progress', authMiddleware, getRoleProgressController);

export default router;
