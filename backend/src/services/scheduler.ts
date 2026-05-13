import { PgBoss } from 'pg-boss';
import type { Job } from 'pg-boss/dist/types';
import cron from 'node-cron';
import prisma from '../config/prisma';
import { sendReminderEmail, sendStreakAtRiskEmail } from './email.service';
import { checkAndResetExpiredStreaks } from './streak.service';
import { logger } from '../utils/logger';

// ── pg-boss uses your existing DATABASE_URL ───────────────────────────────────

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL!,
});

boss.on('error', (err) => logger.error('pg-boss error:', err));

// ── Worker types ──────────────────────────────────────────────────────────────

interface ActivateSessionData {
  sessionId: string;
  userId: string;
}

interface SendReminderData {
  email: string;
  sessionTitle: string;
  scheduledAt: string;
}

// ── Worker: activate a SCHEDULED session when its time arrives ────────────────

async function handleActivateSession(jobs: Job<ActivateSessionData>[]) {
  for (const job of jobs) {
    const { sessionId, userId } = job.data;
    const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });

    if (!session || (session.status as string) !== 'SCHEDULED') {
      logger.warn(`activate-session: skipping ${sessionId} (status=${session?.status})`);
      continue;
    }

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status: 'CREATED' },
    });

    logger.info(`pg-boss: activated session ${sessionId} for user ${userId}`);
  }
}

// ── Worker: send a reminder email 15 min before the session ──────────────────

async function handleSendReminder(jobs: Job<SendReminderData>[]) {
  for (const job of jobs) {
    const { email, sessionTitle, scheduledAt } = job.data;
    await sendReminderEmail({ to: email, sessionTitle, scheduledAt: new Date(scheduledAt) });
    logger.info(`pg-boss: reminder sent to ${email}`);
  }
}

// ── Start everything ──────────────────────────────────────────────────────────

export async function startScheduler() {
  await boss.start();
  logger.info('pg-boss started — job queue ready (PostgreSQL-backed)');

  // Register workers
  await boss.work<ActivateSessionData>('activate-session', handleActivateSession);
  await boss.work<SendReminderData>('send-reminder', handleSendReminder);

  // Nightly cron at 00:05 UTC
  cron.schedule('5 0 * * *', async () => {
    logger.info('Cron: running nightly streak expiry + at-risk emails');
    await runNightlyStreak();
  }, { timezone: 'UTC' });

  logger.info('Cron jobs registered');
}

export async function stopScheduler() {
  await boss.stop();
}

// ── Job scheduling helpers ────────────────────────────────────────────────────

// Store job IDs so we can cancel them later
const jobIdMap = new Map<string, { activateId?: string; reminderId?: string }>();

/**
 * Call this when a session is scheduled.
 * Enqueues an activation job at scheduledAt and a reminder 15 min before.
 */
export async function enqueueSessionJobs(opts: {
  sessionId: string;
  userId: string;
  userEmail: string;
  title: string;
  scheduledAt: Date;
}) {
  const { sessionId, userId, userEmail, title, scheduledAt } = opts;
  const now = new Date();
  const ids: { activateId?: string; reminderId?: string } = {};

  // Activation job — fires exactly at scheduledAt
  const activateId = await boss.send(
    'activate-session',
    { sessionId, userId },
    { startAfter: scheduledAt }
  );
  if (activateId) ids.activateId = activateId;

  // Reminder job — fires 15 minutes before (only if there's enough lead time)
  const reminderAt = new Date(scheduledAt.getTime() - 15 * 60 * 1000);
  if (reminderAt > now) {
    const reminderId = await boss.send(
      'send-reminder',
      { email: userEmail, sessionTitle: title, scheduledAt: scheduledAt.toISOString() },
      { startAfter: reminderAt }
    );
    if (reminderId) ids.reminderId = reminderId;
  }

  jobIdMap.set(sessionId, ids);
  logger.info(`pg-boss: enqueued jobs for session ${sessionId} (activates ${scheduledAt.toISOString()})`);
}

/**
 * Call this when a session is cancelled — removes both pending jobs.
 */
export async function removeSessionJobs(sessionId: string) {
  const ids = jobIdMap.get(sessionId);
  if (ids) {
    if (ids.activateId) {
      await boss.cancel('activate-session', ids.activateId).catch(() => {});
    }
    if (ids.reminderId) {
      await boss.cancel('send-reminder', ids.reminderId).catch(() => {});
    }
    jobIdMap.delete(sessionId);
  }
  logger.info(`pg-boss: cancelled jobs for session ${sessionId}`);
}

// ── Nightly streak logic ──────────────────────────────────────────────────────

export async function runNightlyStreak() {
  // 1. Reset expired streaks
  await checkAndResetExpiredStreaks();

  // 2. Find users whose streak is at risk (practiced yesterday, not today)
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const dayBeforeYesterday = new Date(yesterday);
    dayBeforeYesterday.setUTCDate(dayBeforeYesterday.getUTCDate() - 1);

    const atRisk = await prisma.userProfile.findMany({
      where: {
        currentStreak: { gt: 2 },
        lastPracticeDate: { gte: dayBeforeYesterday, lt: new Date() },
      },
      include: { user: { select: { email: true } } },
    });

    for (const profile of atRisk) {
      if (profile.user?.email) {
        await sendStreakAtRiskEmail({
          to: profile.user.email,
          currentStreak: profile.currentStreak,
        });
      }
    }

    if (atRisk.length > 0) {
      logger.info(`Cron: sent streak-at-risk emails to ${atRisk.length} users`);
    }
  } catch (err) {
    logger.error('Cron: streak-at-risk email error:', err);
  }
}
