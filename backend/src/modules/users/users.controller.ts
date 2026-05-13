import { Request, Response, NextFunction } from 'express';
import * as UsersService from './users.service';
import { updateUserSchema } from './users.schema';
import { sendSuccess, sendError } from '../../utils/apiResponse';

export const getMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await UsersService.getMe(req.user.id);
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 'VALIDATION_ERROR', parsed.error.message, 400);
    const user = await UsersService.updateMe(req.user.id, parsed.data);
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};
