import { Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import {
  scheduleSession,
  getScheduledSessions,
  cancelScheduledSession,
  rescheduleSession,
} from '../../services/scheduling.service';

export const scheduleInterview = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await scheduleSession(req.user.id, req.body);
    return sendSuccess(res, result, 201);
  } catch (err) { next(err); }
};

export const listScheduled = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await getScheduledSessions(req.user.id);
    return sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const cancelScheduled = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await cancelScheduledSession(req.user.id, req.params.id);
    return sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const reschedule = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await rescheduleSession(req.user.id, req.params.id, req.body.scheduledAt);
    return sendSuccess(res, result);
  } catch (err) { next(err); }
};
