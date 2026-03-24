import prisma from '../config/prisma';

const getRatingLabel = (score: number): string => {
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Good';
  if (score >= 5) return 'Average';
  return 'Needs Improvement';
};

const avg = (arr: (number | null)[]): number => {
  const valid = arr.filter((n) => n !== null) as number[];
  return valid.length
    ? parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1))
    : 0;
};

export const generateReport = async (sessionId: string) => {
  const analyses = await prisma.responseAnalysis.findMany({
    where: { response: { sessionId } },
  });

  if (analyses.length === 0) return null;

  const overallScore = avg(analyses.map((a) => a.overallScore));

  const report = await prisma.report.upsert({
    where: { sessionId },
    update: {
      overallScore,
      ratingLabel: getRatingLabel(overallScore),
      summary:
        'Strong performance with room to improve confidence and technical depth.',
      strengthsJson: ['Clear communication', 'Good answer structure'],
      weaknessesJson: ['Filler words', 'Technical depth'],
      recommendationsJson: [
        'Practice concise answers',
        'Use measurable examples',
      ],
      radarDataJson: {
        labels: [
          'Communication',
          'Confidence',
          'Technical',
          'Clarity',
          'Fluency',
        ],
        values: [
          avg(analyses.map((a) => a.clarityScore)),
          avg(analyses.map((a) => a.confidenceScore)),
          avg(analyses.map((a) => a.technicalScore)),
          avg(analyses.map((a) => a.clarityScore)),
          avg(analyses.map((a) => a.fluencyScore)),
        ],
      },
    },
    create: {
      sessionId,
      overallScore,
      ratingLabel: getRatingLabel(overallScore),
      summary:
        'Strong performance with room to improve confidence and technical depth.',
      strengthsJson: ['Clear communication', 'Good answer structure'],
      weaknessesJson: ['Filler words', 'Technical depth'],
      recommendationsJson: [
        'Practice concise answers',
        'Use measurable examples',
      ],
      radarDataJson: {
        labels: [
          'Communication',
          'Confidence',
          'Technical',
          'Clarity',
          'Fluency',
        ],
        values: [
          avg(analyses.map((a) => a.clarityScore)),
          avg(analyses.map((a) => a.confidenceScore)),
          avg(analyses.map((a) => a.technicalScore)),
          avg(analyses.map((a) => a.clarityScore)),
          avg(analyses.map((a) => a.fluencyScore)),
        ],
      },
    },
  });

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: 'COMPLETED', overallScore },
  });

  return report;
};
