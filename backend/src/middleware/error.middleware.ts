import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ error: err.error, message: err.message });
  }
  console.error(err);
  res
    .status(500)
    .json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' });
};
