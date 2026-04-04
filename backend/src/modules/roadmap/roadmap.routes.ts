import { Router } from 'express';
import { getRoadmap, getNodeInfo, saveRoadmap, getRoadmapBySession } from './roadmap.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.post('/roadmap/generate', authMiddleware, getRoadmap);
router.post('/roadmap/node-info', authMiddleware, getNodeInfo);
router.post('/sessions/:id/roadmap', authMiddleware, saveRoadmap);
router.get('/sessions/:id/roadmap', authMiddleware, getRoadmapBySession);

export default router;
