import { Response, NextFunction } from 'express';
import * as ReportsService from './reports.service';
import { sendSuccess } from '../../utils/apiResponse';

export const getReport = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await ReportsService.getReport(req.user.id, req.params.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
