const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (message: string, data?: any) => {
    if (isDev) console.log(`[INFO] ${message}`, data ?? '');
  },
  error: (message: string, err?: any) => {
    console.error(`[ERROR] ${message}`, err ?? '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data ?? '');
  },
  debug: (message: string, data?: any) => {
    if (isDev) console.log(`[DEBUG] ${message}`, data ?? '');
  },
};
