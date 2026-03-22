import { Response, NextFunction } from 'express';

export const requireVerifiedEmail = (
  req: any,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      error: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email before using this feature.',
    });
  }
  next();
};
