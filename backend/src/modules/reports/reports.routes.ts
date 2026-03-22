import { Router } from 'express';
import { getReport } from './reports.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/sessions/:id/report', authMiddleware, getReport);

export default router;
