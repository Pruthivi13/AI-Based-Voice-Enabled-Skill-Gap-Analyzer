import { Request, Response, NextFunction } from 'express';
import * as QuestionsService from './questions.service';
import { sendSuccess } from '../../utils/apiResponse';

export const getAllQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category, difficulty } = req.query;
    const questions = await QuestionsService.getAllQuestions(
      category as string,
      difficulty as string
    );
    return sendSuccess(res, questions);
  } catch (err) {
    next(err);
  }
};

export const getQuestionById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params as { id: string };
    const question = await QuestionsService.getQuestionById(id);
    return sendSuccess(res, question);
  } catch (err) {
    next(err);
  }
};
