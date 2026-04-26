import { Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { getRandomWarmupQuestion } from './warmup.service';

/**
 * GET /api/warmup/question
 * Returns a random warmup question.
 */
export const getWarmupQuestion = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const question = getRandomWarmupQuestion();
    return sendSuccess(res, { question });
  } catch (err) {
    next(err);
  }
};
