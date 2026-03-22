import app from './app';
import { env } from './config/env';
import prisma from './config/prisma';
import { seedQuestions } from './modules/questions/seed';

const start = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    await seedQuestions();

    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();
