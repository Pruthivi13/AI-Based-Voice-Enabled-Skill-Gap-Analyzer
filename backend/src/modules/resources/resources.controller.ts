import { Response, NextFunction } from 'express';
import { getPersonalizedResources, getStaticResources } from './resources.service';
import { sendSuccess } from '../../utils/apiResponse';

/**
 * GET /api/resources
 * Returns personalized course recommendations derived from the user's
 * weak categories (from past interview analyses).
 * Falls back to static curated resources if fetch fails.
 */
export const getResources = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await getPersonalizedResources(req.user.id);
    return sendSuccess(res, result);
  } catch (err) {
    // On any failure (e.g. no Serper key) return static curated list
    try {
      const statics = await getStaticResources();
      return sendSuccess(res, {
        resources: statics,
        weakCategories: ['Technical', 'Communication', 'Fluency', 'Confidence'],
        totalCount: statics.length,
      });
    } catch (e) {
      next(e);
    }
  }
};
