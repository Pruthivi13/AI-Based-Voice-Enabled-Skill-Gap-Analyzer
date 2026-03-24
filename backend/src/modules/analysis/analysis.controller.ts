import { Response, NextFunction } from 'express';
import * as AnalysisService from './analysis.service';
import { sendSuccess } from '../../utils/apiResponse';

export const getProcessingStatus = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AnalysisService.getProcessingStatus(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getQuestionSummary = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AnalysisService.getQuestionSummary(
      req.user.id,
      req.params.id,
      req.params.qid
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getSessionAnalysis = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AnalysisService.getSessionAnalysis(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getSessionReview = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AnalysisService.getSessionReview(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const generateAnalysis = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AnalysisService.generateMockAnalysis(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
