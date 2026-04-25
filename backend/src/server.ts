import app from './app';
import { env } from './config/env';
import prisma from './config/prisma';
import { seedQuestions } from './modules/questions/seed';
import { setupWebSocket } from './websocket';
import { startScheduler, stopScheduler } from './services/scheduler';
import http from 'http';

const start = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    await seedQuestions();

    // Start pg-boss job queue + cron jobs
    await startScheduler();

    // Create HTTP server manually so WebSocket can share it
    const server = http.createServer(app);

    // Attach WebSocket proxy
    setupWebSocket(server);

    server.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`);
      console.log(
        `🔌 WebSocket proxy ready on ws://localhost:${env.PORT}/ws/transcribe`
      );
    });

    // Graceful shutdown
    const shutdown = async () => {
      await stopScheduler();
      server.close(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();

