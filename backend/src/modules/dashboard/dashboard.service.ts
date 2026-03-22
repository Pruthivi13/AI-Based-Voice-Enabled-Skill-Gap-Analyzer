import prisma from '../../config/prisma';

export const getDashboard = async (userId: string) => {
  const recentSessions = await prisma.interviewSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { report: true },
  });

  const allSessions = await prisma.interviewSession.findMany({
    where: { userId, status: 'COMPLETED' },
    include: { report: true },
  });

  const scores = allSessions
    .map((s) => s.overallScore)
    .filter((s) => s !== null) as number[];

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
    })),
    analytics: {
      averageScore,
      totalSessions: allSessions.length,
      focusArea: 'Confidence',
    },
  };
};
