/**
 * roleProgress.service.ts
 *
 * Aggregates per-role performance from InterviewSession + SkillSnapshot.
 * No new migrations needed — reads existing tables.
 */
import prisma from '../config/prisma';

export interface RoleSession {
  date: Date | null;
  score: number | null;
}

export interface RoleProgress {
  role: string;
  sessionCount: number;
  avgScore: number | null;
  firstScore: number | null;
  latestScore: number | null;
  improvement: number | null;
  trend: 'up' | 'down' | 'flat' | 'new';
  lastPracticed: Date | null;
  sessions: RoleSession[];
  skills: {
    clarity:    number | null;
    fluency:    number | null;
    confidence: number | null;
    technical:  number | null;
    grammar:    number | null;
    relevance:  number | null;
  };
}

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null);
  if (!valid.length) return null;
  return parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
}

function computeTrend(first: number | null, latest: number | null): 'up' | 'down' | 'flat' | 'new' {
  if (first === null || latest === null) return 'new';
  const diff = latest - first;
  if (diff > 0.2)  return 'up';
  if (diff < -0.2) return 'down';
  return 'flat';
}

export async function getRoleProgress(userId: string): Promise<RoleProgress[]> {
  const sessions = await prisma.interviewSession.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { endedAt: 'asc' },
    select: {
      id: true,
      targetRole: true,
      overallScore: true,
      endedAt: true,
      startedAt: true,
      snapshot: {
        select: {
          clarityScore:    true,
          fluencyScore:    true,
          confidenceScore: true,
          technicalScore:  true,
          grammarScore:    true,
          relevanceScore:  true,
        },
      },
    },
  });

  // Group by targetRole
  const byRole = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = s.targetRole.trim();
    if (!byRole.has(key)) byRole.set(key, []);
    byRole.get(key)!.push(s);
  }

  const results: RoleProgress[] = [];

  for (const [role, roleSessions] of byRole) {
    const sorted = [...roleSessions].sort(
      (a, b) =>
        new Date(a.endedAt ?? a.startedAt).getTime() -
        new Date(b.endedAt ?? b.startedAt).getTime()
    );

    const scores      = sorted.map(s => s.overallScore);
    const firstScore  = scores[0] ?? null;
    const latestScore = scores[scores.length - 1] ?? null;
    const improvement =
      firstScore !== null && latestScore !== null
        ? parseFloat((latestScore - firstScore).toFixed(1))
        : null;

    const sparkline = sorted.slice(-10).map(s => ({
      date:  s.endedAt ?? s.startedAt,
      score: s.overallScore,
    }));

    const snapshots = sorted
      .map(s => s.snapshot)
      .filter((sn): sn is NonNullable<typeof sn> => sn !== null);

    results.push({
      role,
      sessionCount:  sorted.length,
      avgScore:      avg(scores),
      firstScore,
      latestScore,
      improvement,
      trend:         computeTrend(firstScore, latestScore),
      lastPracticed: sorted[sorted.length - 1]?.endedAt ?? null,
      sessions:      sparkline,
      skills: {
        clarity:    avg(snapshots.map(sn => sn.clarityScore)),
        fluency:    avg(snapshots.map(sn => sn.fluencyScore)),
        confidence: avg(snapshots.map(sn => sn.confidenceScore)),
        technical:  avg(snapshots.map(sn => sn.technicalScore)),
        grammar:    avg(snapshots.map(sn => sn.grammarScore)),
        relevance:  avg(snapshots.map(sn => sn.relevanceScore)),
      },
    });
  }

  results.sort((a, b) => b.sessionCount - a.sessionCount || a.role.localeCompare(b.role));
  return results;
}
