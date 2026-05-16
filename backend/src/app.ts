import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import prisma from './config/prisma';
import { defaultRateLimit } from './middleware/rateLimit.middleware';
import userRoutes from './modules/users/users.routes';
import sessionRoutes from './modules/sessions/sessions.routes';
import uploadRoutes from './modules/uploads/uploads.routes';
import analysisRoutes from './modules/analysis/analysis.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import settingsRoutes from './modules/settings/settings.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import resourcesRoutes from './modules/resources/resources.routes';
import questionRoutes from './modules/questions/questions.routes';
import reportsRoutes from './modules/reports/reports.routes';
import roadmapRoutes from './modules/roadmap/roadmap.routes';
import coursesRoutes from './modules/courses/courses.routes';
import followupRoutes from './modules/sessions/followup.routes';
import scheduleRoutes from './modules/schedule/schedule.routes';
import bookmarksRoutes from './modules/bookmarks/bookmarks.routes';
import notesRoutes from './modules/notes/notes.routes';
import warmupRoutes from './modules/warmup/warmup.routes';
import questionFeedbackRoutes from './modules/questions/questionFeedback.routes';

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    const allowed = [
      env.FRONTEND_ORIGIN,
      'http://localhost:5173',
      'http://localhost:5174',
    ];
    if (allowed.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  maxAge: 0, // Never cache preflight — forces browsers to re-validate every time
};

const app = express();

// CORS must come before helmet so its headers aren't stripped
app.use(cors(corsOptions));
// Handle preflight OPTIONS for all routes (Express 5 compatible regex wildcard)
app.options(/.*/, cors(corsOptions));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(defaultRateLimit);

// ── Health-check endpoints ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/health/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', message: 'Database connection is healthy' });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: 'Database connection failed',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.use('/api', userRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', sessionRoutes);
app.use('/api', uploadRoutes);
app.use('/api', analysisRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', settingsRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', resourcesRoutes);
app.use('/api', questionRoutes);
app.use('/api', reportsRoutes);
app.use('/api', followupRoutes);
app.use('/api', bookmarksRoutes);
app.use('/api', notesRoutes);
app.use('/api', warmupRoutes);
app.use('/api', questionFeedbackRoutes);

app.use(errorMiddleware);

app.use('/api', roadmapRoutes);
app.use('/api', coursesRoutes);

export default app;
