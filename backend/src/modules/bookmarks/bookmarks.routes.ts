import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  toggleBookmark,
  updateNote,
  getBookmarks,
  getBookmarkStatus,
  deleteBookmark,
} from './bookmarks.controller';

const router = Router();

// GET  /api/bookmarks              — list all bookmarks for the user
// GET  /api/bookmarks/status?ids=  — batch-check bookmark status
// POST /api/bookmarks/:questionId  — toggle bookmark on/off
// PUT  /api/bookmarks/:questionId/note — update note
// DELETE /api/bookmarks/:bookmarkId   — delete a bookmark

router.get('/bookmarks',              authMiddleware, getBookmarks);
router.get('/bookmarks/status',       authMiddleware, getBookmarkStatus);
router.post('/bookmarks/:questionId', authMiddleware, toggleBookmark);
router.put('/bookmarks/:questionId/note', authMiddleware, updateNote);
router.delete('/bookmarks/:bookmarkId',   authMiddleware, deleteBookmark);

export default router;
