import prisma from '../config/prisma';
import { logger } from '../utils/logger';

/**
 * Normalizes a Date to midnight UTC for day-level comparisons.
 */
function toUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Returns the difference in calendar days between two dates (UTC).
 * Positive if `b` is after `a`.
 */
function daysDiff(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toUTCDay(b).getTime() - toUTCDay(a).getTime()) / msPerDay);
}

/**
 * Called whenever a session is marked COMPLETED.
 * Updates currentStreak, longestStreak, lastPracticeDate on UserProfile.
 */
export async function updateStreak(userId: string): Promise<void> {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      logger.warn(`updateStreak: no profile found for userId=${userId}`);
      return;
    }

    const today = toUTCDay(new Date());
    const lastDate = profile.lastPracticeDate ? toUTCDay(profile.lastPracticeDate) : null;

    let newStreak = profile.currentStreak ?? 0;

    if (!lastDate) {
      // First practice ever
      newStreak = 1;
    } else {
      const diff = daysDiff(lastDate, today);
      if (diff === 0) {
        // Already practiced today — no change
        return;
      } else if (diff === 1) {
        // Practiced yesterday → extend streak
        newStreak = newStreak + 1;
      } else {
        // Gap > 1 day → reset
        newStreak = 1;
      }
    }

    const newLongest = Math.max(newStreak, profile.longestStreak ?? 0);

    await prisma.userProfile.update({
      where: { userId },
      data: {
        currentStreak:    newStreak,
        longestStreak:    newLongest,
        lastPracticeDate: today,
      },
    });

    logger.info(`Streak updated for user ${userId}: ${newStreak} days (longest: ${newLongest})`);
  } catch (err) {
    logger.error('updateStreak error:', err);
  }
}

/**
 * Returns streak info for the dashboard.
 */
export async function getStreakInfo(userId: string) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return { currentStreak: 0, longestStreak: 0, lastPracticeDate: null, streakAtRisk: false };

  const today = toUTCDay(new Date());
  const lastDate = profile.lastPracticeDate ? toUTCDay(profile.lastPracticeDate) : null;

  // Streak is "at risk" if lastPracticeDate was yesterday (haven't practiced today)
  let streakAtRisk = false;
  if (lastDate && (profile.currentStreak ?? 0) > 0) {
    const diff = daysDiff(lastDate, today);
    streakAtRisk = diff === 1; // practiced yesterday, not yet today
  }

  return {
    currentStreak:    profile.currentStreak ?? 0,
    longestStreak:    profile.longestStreak ?? 0,
    lastPracticeDate: profile.lastPracticeDate ?? null,
    streakAtRisk,
  };
}

/**
 * Returns the heatmap data: array of { date: string (YYYY-MM-DD), count: number }
 * for the last `days` calendar days.
 */
export async function getPracticeHeatmap(userId: string, days = 365) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const sessions = await prisma.interviewSession.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      endedAt: { gte: since },
    },
    select: { endedAt: true },
  });

  // Aggregate by calendar day (UTC)
  const countByDay: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const key = toUTCDay(s.endedAt).toISOString().slice(0, 10);
    countByDay[key] = (countByDay[key] ?? 0) + 1;
  }

  return Object.entries(countByDay).map(([date, count]) => ({ date, count }));
}

/**
 * Called by the nightly cron job.
 * Resets currentStreak to 0 for users who missed yesterday.
 */
export async function checkAndResetExpiredStreaks(): Promise<string[]> {
  try {
    const yesterday = toUTCDay(new Date());
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    // Find profiles whose last practice was before yesterday (streak expired)
    const stale = await prisma.userProfile.findMany({
      where: {
        currentStreak: { gt: 0 },
        lastPracticeDate: { lt: yesterday },
      },
      select: { userId: true, currentStreak: true },
    });

    if (stale.length === 0) return [];

    const userIds = stale.map((p) => p.userId);

    await prisma.userProfile.updateMany({
      where: { userId: { in: userIds } },
      data: { currentStreak: 0 },
    });

    logger.info(`Cron: reset streaks for ${stale.length} users`);
    return userIds;
  } catch (err) {
    logger.error('checkAndResetExpiredStreaks error:', err);
    return [];
  }
}
