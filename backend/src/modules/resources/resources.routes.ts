import { Router } from 'express';
import { getResources } from './resources.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { strictRateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

router.get('/resources', authMiddleware, strictRateLimit, getResources);

export default router;
