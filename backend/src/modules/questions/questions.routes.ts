import { Router } from 'express';
import { getAllQuestions, getQuestionById } from './questions.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/questions', authMiddleware, getAllQuestions);
router.get('/questions/:id', authMiddleware, getQuestionById);

export default router;
