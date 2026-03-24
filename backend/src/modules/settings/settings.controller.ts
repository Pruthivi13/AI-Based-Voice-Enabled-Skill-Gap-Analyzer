import { Response, NextFunction } from 'express';
import * as SettingsService from './settings.service';
import { sendSuccess } from '../../utils/apiResponse';

export const getSettings = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await SettingsService.getSettings(req.user.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await SettingsService.updateSettings(req.user.id, req.body);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
