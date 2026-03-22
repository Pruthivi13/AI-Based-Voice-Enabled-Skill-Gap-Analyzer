import prisma from '../../config/prisma';

export const getAnalytics = async (userId: string) => {
  const sessions = await prisma.interviewSession.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { createdAt: 'asc' },
    include: { report: true },
  });

  const scores = sessions
    .map((s) => s.overallScore)
    .filter((s) => s !== null) as number[];

  const averageScore = scores.length
    ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
    : 0;

  const scoreTrend = sessions.map((s) => ({
    label: new Date(s.createdAt).toLocaleDateString('en-US', {
      month: 'short',
    }),
    score: s.overallScore ?? 0,
  }));

  return {
    totalSessions: sessions.length,
    averageScore,
    mostImproved: 'Communication',
    focusArea: 'Confidence',
    scoreTrend,
    weakAreas: [
      { label: 'Confidence', count: 4 },
      { label: 'Technical Depth', count: 3 },
      { label: 'Filler Words', count: 2 },
    ],
    competencyAverages: {
      communication: 7.8,
      confidence: 7.0,
      technicalKnowledge: 7.6,
      clarity: 7.3,
      fluency: 7.1,
    },
  };
};
