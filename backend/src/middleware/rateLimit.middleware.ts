import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const message = {
  error: 'TOO_MANY_REQUESTS',
  message: 'Too many requests, please try again later.',
};

const skipDevLocalhost = (req: any) => {
  if (!isDev) return false;

  const remoteAddress = req.socket?.remoteAddress;
  return [req.ip, remoteAddress].some((address) =>
    ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(address)
  );
};

export const defaultRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipDevLocalhost,
  message,
});

export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipDevLocalhost,
  message,
});
