import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  scheduleInterview,
  listScheduled,
  cancelScheduled,
  reschedule,
} from './schedule.controller';

const router = Router();

router.post('/sessions/schedule',        authMiddleware, scheduleInterview);
router.get('/sessions/scheduled',        authMiddleware, listScheduled);
router.post('/sessions/:id/cancel',      authMiddleware, cancelScheduled);
router.patch('/sessions/:id/reschedule', authMiddleware, reschedule);

export default router;
