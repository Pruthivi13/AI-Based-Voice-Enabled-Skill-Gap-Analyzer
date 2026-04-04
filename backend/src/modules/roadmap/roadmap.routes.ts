import { Router } from 'express';
import { getRoadmap, getNodeInfo } from './roadmap.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.post('/roadmap/generate', authMiddleware, getRoadmap);
router.post('/roadmap/node-info', authMiddleware, getNodeInfo);

export default router;
