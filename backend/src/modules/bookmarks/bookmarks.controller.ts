import { Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import * as BookmarksService from './bookmarks.service';

export const toggleBookmark = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { questionId } = req.params;
    const { note } = req.body;
    const result = await BookmarksService.toggleBookmark(
      req.user.id,
      questionId,
      note
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const updateNote = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { questionId } = req.params;
    const { note } = req.body;
    const result = await BookmarksService.updateBookmarkNote(
      req.user.id,
      questionId,
      note ?? ''
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getBookmarks = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await BookmarksService.getBookmarks(req.user.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getBookmarkStatus = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    // Accepts ?ids=id1,id2,id3
    const raw = (req.query.ids as string) || '';
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await BookmarksService.getBookmarkStatus(req.user.id, ids);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const deleteBookmark = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await BookmarksService.deleteBookmark(
      req.user.id,
      req.params.bookmarkId
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
