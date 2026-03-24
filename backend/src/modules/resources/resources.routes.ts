import { Router } from 'express';
import { getResources } from './resources.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/resources', authMiddleware, getResources);

export default router;
