import { Router } from 'express';
import { getCourses } from './courses.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/sessions/:id/courses
 * Returns cached or freshly-fetched course recommendations for a session.
 * Idempotent — safe to call multiple times; DB cache prevents extra Serper hits.
 */
router.get('/sessions/:id/courses', authMiddleware, getCourses);

export default router;
