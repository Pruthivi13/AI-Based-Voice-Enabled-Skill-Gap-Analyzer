import { Response, NextFunction } from 'express';
import * as DashboardService from './dashboard.service';
import { sendSuccess } from '../../utils/apiResponse';

export const getDashboard = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await DashboardService.getDashboard(req.user.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
