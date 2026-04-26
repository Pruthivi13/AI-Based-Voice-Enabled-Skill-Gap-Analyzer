import { Response, NextFunction } from 'express';
import * as AnalyticsService from './analytics.service';
import { sendSuccess } from '../../utils/apiResponse';
import { analyzeWeakSkills } from '../../services/weakSkillAnalyzer.service';

export const getAnalytics = async (
  req: any, res: Response, next: NextFunction
) => {
  try {
    const result = await AnalyticsService.getAnalytics(req.user.id);
    return sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const getWeakSkillPrescription = async (
  req: any, res: Response, next: NextFunction
) => {
  try {
    const prescription = await analyzeWeakSkills(req.user.id);
    return sendSuccess(res, prescription);
  } catch (err) { next(err); }
};
