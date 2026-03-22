import { Router } from 'express';
import { getMe, updateMe } from './users.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateUserSchema } from './users.schema';

const router = Router();

// Auth is handled by Firebase...no register/login endpoints needed
router.get('/users/me', authMiddleware, getMe);
router.put('/users/me', authMiddleware, validate(updateUserSchema), updateMe);

export default router;
