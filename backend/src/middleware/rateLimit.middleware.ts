import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const message = {
  error: 'TOO_MANY_REQUESTS',
  message: 'Too many requests, please try again later.',
};

export const defaultRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});
