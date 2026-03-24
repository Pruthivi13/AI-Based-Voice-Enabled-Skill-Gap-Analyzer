// import rateLimit from 'express-rate-limit';

// export const defaultRateLimit = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 1000,
//   message: {
//     error: 'TOO_MANY_REQUESTS',
//     message: 'Too many requests, please try again later.',
//   },
// });

// export const strictRateLimit = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 500,
//   message: {
//     error: 'TOO_MANY_REQUESTS',
//     message: 'Too many requests, please try again later.',
//   },
// });

import { Request, Response, NextFunction } from 'express';

// Rate limiting disabled for development
export const defaultRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => next();
export const strictRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => next();
