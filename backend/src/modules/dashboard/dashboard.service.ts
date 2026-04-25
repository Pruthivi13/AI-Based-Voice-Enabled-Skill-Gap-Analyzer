import prisma from '../../config/prisma';
import { getStreakInfo, getPracticeHeatmap } from '../../services/streak.service';
import { getNextScheduledSession } from '../../services/scheduling.service';

export const getDashboard = async (userId: string) => {
  const [recentSessions, allSessions, streakInfo, heatmap, nextScheduled] =
    await Promise.all([
      prisma.interviewSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { report: true },
      }),
      prisma.interviewSession.findMany({
        where: { userId, status: 'COMPLETED' },
      }),
      getStreakInfo(userId),
      getPracticeHeatmap(userId, 365),
      getNextScheduledSession(userId),
    ]);

  const scores = allSessions
    .map((s) => s.overallScore)
    .filter((s): s is number => s !== null);

  const averageScore = scores.length
    ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
    : 0;

  return {
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      title: s.title,
      score: s.overallScore,
      date: s.createdAt,
      status: s.status,
      scheduledAt: s.scheduledAt,
    })),
    analytics: {
      averageScore,
      totalSessions: allSessions.length,
    },
    streak: streakInfo,
    heatmap,
    nextInterview: nextScheduled
      ? {
          id: nextScheduled.id,
          title: nextScheduled.title,
          scheduledAt: nextScheduled.scheduledAt,
          targetRole: nextScheduled.targetRole,
          interviewType: nextScheduled.interviewType,
        }
      : null,
  };
};
