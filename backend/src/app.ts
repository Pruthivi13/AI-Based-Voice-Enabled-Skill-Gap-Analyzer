import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
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

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(defaultRateLimit);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.use('/api', userRoutes);
app.use('/api', sessionRoutes);
app.use('/api', uploadRoutes);
app.use('/api', analysisRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', settingsRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', resourcesRoutes);
app.use('/api', questionRoutes);
app.use('/api', reportsRoutes);

app.use(errorMiddleware);

export default app;
