import { Router } from 'express';
import { getSettings, updateSettings } from './settings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/settings', authMiddleware, getSettings);
router.put('/settings', authMiddleware, updateSettings);

export default router;
