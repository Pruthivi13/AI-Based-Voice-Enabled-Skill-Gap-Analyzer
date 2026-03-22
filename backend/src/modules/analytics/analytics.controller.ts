import { Response, NextFunction } from 'express';
import * as AnalyticsService from './analytics.service';
import { sendSuccess } from '../../utils/apiResponse';

export const getAnalytics = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AnalyticsService.getAnalytics(req.user.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
