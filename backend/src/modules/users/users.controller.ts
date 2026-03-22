import { Request, Response, NextFunction } from 'express';
import * as UsersService from './users.service';
import { registerSchema, loginSchema, updateUserSchema } from './users.schema';
import { sendSuccess, sendError } from '../../utils/apiResponse';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 'VALIDATION_ERROR', parsed.error.message, 400);
    const { email, password, fullName } = parsed.data;
    const result = await UsersService.registerUser(email, password, fullName);
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 'VALIDATION_ERROR', parsed.error.message, 400);
    const { email, password } = parsed.data;
    const result = await UsersService.loginUser(email, password);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

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
