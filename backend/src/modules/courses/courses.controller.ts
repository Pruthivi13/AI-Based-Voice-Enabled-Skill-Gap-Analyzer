import { Response, NextFunction } from 'express';
import { getCourseRecommendations } from './courses.service';
import { sendSuccess } from '../../utils/apiResponse';

export const getCourses = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getCourseRecommendations(
      req.user.id,
      req.params.id   // sessionId from /sessions/:id/courses
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
