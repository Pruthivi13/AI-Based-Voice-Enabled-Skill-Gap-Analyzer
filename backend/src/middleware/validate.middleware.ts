import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues;
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: issues[0]?.message ?? 'Validation failed',
        details: issues,
      });
    }
    req.body = result.data;
    next();
  };
};
