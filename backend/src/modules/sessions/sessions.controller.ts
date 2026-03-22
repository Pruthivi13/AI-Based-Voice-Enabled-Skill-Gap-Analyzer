import { Response, NextFunction } from 'express';
import * as SessionsService from './sessions.service';
import { createSessionSchema } from './sessions.schema';
import { sendSuccess, sendError } from '../../utils/apiResponse';

export const createSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 'VALIDATION_ERROR', parsed.error.message, 400);
    const result = await SessionsService.createSession(
      req.user.id,
      parsed.data
    );
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};

export const getSessions = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const result = await SessionsService.getSessions(req.user.id, page, limit);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getSessionById = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await SessionsService.getSessionById(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, session);
  } catch (err) {
    next(err);
  }
};

export const getSessionQuestions = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const questions = await SessionsService.getSessionQuestions(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, questions);
  } catch (err) {
    next(err);
  }
};

export const finishSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await SessionsService.finishSession(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
