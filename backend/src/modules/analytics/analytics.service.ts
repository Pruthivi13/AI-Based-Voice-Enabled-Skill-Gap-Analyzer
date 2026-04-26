/**
 * analytics.service.ts
 *
 * Returns all data needed by AnalyticsPage — computed from real DB data only.
 * No hardcoded values. Returns empty/zero state when user has no sessions.
 */
import prisma from '../../config/prisma';
import { getSkillTimeline, getLatestSkillDelta } from '../../services/skillSnapshot.service';

function avg(nums: (number | null)[]): number {
  const valid = nums.filter((n): n is number => n !== null && !isNaN(n));
  if (!valid.length) return 0;
  return parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
}

export const getAnalytics = async (userId: string) => {
  const [sessions, skillTimeline, skillDelta] = await Promise.all([
    prisma.interviewSession.findMany({
      where:   { userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'asc' },
      include: {
        report: true,
        responses: {
          include: { analysis: true },
        },
      },
    }),
    getSkillTimeline(userId, 90),
    getLatestSkillDelta(userId),
  ]);

  // ── Score trend ───────────────────────────────────────────────────────────
  const scores = sessions
    .map(s => s.overallScore)
    .filter((s): s is number => s !== null);

  const averageScore = avg(scores);

  const scoreTrend = sessions.map(s => ({
    label: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: s.overallScore ?? 0,
  }));

  // ── Collect all analyses ──────────────────────────────────────────────────
  const analyses = sessions.flatMap(s =>
    s.responses.map(r => r.analysis).filter(Boolean)
  ) as NonNullable<Awaited<ReturnType<typeof prisma.responseAnalysis.findFirst>>>[];

  if (!analyses.length) {
    // No data at all — return zero state
    return {
      totalSessions: 0,
      averageScore:  0,
      mostImproved:  null,
      focusArea:     null,
      scoreTrend:    [],
      skillTimeline,
      skillDelta,
      weakAreas:           [],
      competencyAverages:  {},
    };
  }

  // ── Competency averages ───────────────────────────────────────────────────
  const competencyAverages: Record<string, number> = {};
  const skillMap: [string, keyof typeof analyses[0]][] = [
    ['communication',      'clarityScore'],
    ['confidence',         'confidenceScore'],
    ['technicalKnowledge', 'technicalScore'],
    ['clarity',            'clarityScore'],
    ['fluency',            'fluencyScore'],
    ['grammar',            'grammarScore'],
    ['relevance',          'relevanceScore'],
  ];

  for (const [label, key] of skillMap) {
    const vals = analyses.map(a => (a as any)[key] as number | null);
    const a = avg(vals);
    if (a > 0) competencyAverages[label] = a;
  }

  // ── Weak areas — skills scoring below 6.5 most often ─────────────────────
  const weakCounts: Record<string, number> = {};
  const THRESHOLD = 6.5;
  const weakSkillMap: [string, keyof typeof analyses[0]][] = [
    ['Confidence',      'confidenceScore'],
    ['Technical Depth', 'technicalScore'],
    ['Fluency',         'fluencyScore'],
    ['Clarity',         'clarityScore'],
    ['Grammar',         'grammarScore'],
  ];

  for (const a of analyses) {
    for (const [label, key] of weakSkillMap) {
      const val = (a as any)[key] as number | null;
      if (val !== null && val < THRESHOLD) {
        weakCounts[label] = (weakCounts[label] ?? 0) + 1;
      }
    }

    // Filler words
    if (a.fillerWordCount && a.fillerWordCount > 5) {
      weakCounts['Filler Words'] = (weakCounts['Filler Words'] ?? 0) + 1;
    }
  }

  const weakAreas = Object.entries(weakCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  // ── Most improved — skill with biggest positive delta ─────────────────────
  let mostImproved: string | null = null;
  if (skillDelta) {
    const deltas: [string, number][] = [
      ['Clarity',    skillDelta.clarity    ?? 0],
      ['Fluency',    skillDelta.fluency    ?? 0],
      ['Confidence', skillDelta.confidence ?? 0],
      ['Technical',  skillDelta.technical  ?? 0],
    ];
    const best = deltas.sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) mostImproved = best[0];
  }

  // ── Focus area — worst competency ─────────────────────────────────────────
  let focusArea: string | null = null;
  if (Object.keys(competencyAverages).length) {
    const worst = Object.entries(competencyAverages).sort((a, b) => a[1] - b[1])[0];
    if (worst) focusArea = worst[0].charAt(0).toUpperCase() + worst[0].slice(1);
  }

  return {
    totalSessions: sessions.length,
    averageScore,
    mostImproved,
    focusArea,
    scoreTrend,
    skillTimeline,
    skillDelta,
    weakAreas,
    competencyAverages,
  };
};
