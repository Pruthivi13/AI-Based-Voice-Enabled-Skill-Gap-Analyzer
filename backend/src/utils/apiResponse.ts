import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, status = 200) => {
  res.status(status).json(data);
};

export const sendError = (
  res: Response,
  error: string,
  message: string,
  status = 400,
  details?: any
) => {
  res.status(status).json({ error, message, details });
};
