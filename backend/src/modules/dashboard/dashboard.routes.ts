import { Router } from 'express';
import { getDashboard } from './dashboard.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/dashboard', authMiddleware, getDashboard);

export default router;
