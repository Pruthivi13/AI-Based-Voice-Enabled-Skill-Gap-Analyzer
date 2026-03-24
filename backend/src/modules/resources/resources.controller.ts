import { Response, NextFunction } from 'express';
import * as ResourcesService from './resources.service';
import { sendSuccess } from '../../utils/apiResponse';

export const getResources = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await ResourcesService.getResources();
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
