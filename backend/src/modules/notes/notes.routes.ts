import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { saveNote, getNote } from './notes.controller';

const router = Router();

// PUT  /api/sessions/:id/questions/:qid/notes — save/update a note
// GET  /api/sessions/:id/questions/:qid/notes — get the note
router.put('/sessions/:id/questions/:qid/notes', authMiddleware, saveNote);
router.get('/sessions/:id/questions/:qid/notes', authMiddleware, getNote);

export default router;
