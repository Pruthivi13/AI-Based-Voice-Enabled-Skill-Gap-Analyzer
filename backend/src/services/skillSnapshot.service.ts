/**
 * skillSnapshot.service.ts
 *
 * Persists a single averaged score row per completed session (SkillSnapshot),
 * then exposes query helpers for the analytics page:
 *   • captureSkillSnapshot  — called after session COMPLETED
 *   • getSkillTimeline      — ordered list for the multi-line chart
 *   • getLatestSkillDelta   — score change vs previous session
 */
import prisma from '../config/prisma';
import { logger } from '../utils/logger';

// ── captureSkillSnapshot ────────────────────────────────────────────────────

/**
 * Called after a session is marked COMPLETED and its report is saved.
 * Averages all ResponseAnalysis scores for the session into a single snapshot.
 */
export async function captureSkillSnapshot(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    // Avoid duplicate snapshots
    const existing = await (prisma as any).skillSnapshot.findUnique({
      where: { sessionId },
    });
    if (existing) return;

    const analyses = await prisma.responseAnalysis.findMany({
      where: { response: { sessionId } },
    });

    if (analyses.length === 0) return;

    const avg = (key: keyof typeof analyses[0]): number | null => {
      const vals = analyses
        .map((a) => a[key] as number | null)
        .filter((v): v is number => v !== null);
      return vals.length
        ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
        : null;
    };

    await (prisma as any).skillSnapshot.upsert({
      where: { sessionId },
      update: {},
      create: {
        userId,
        sessionId,
        clarityScore:    avg('clarityScore'),
        fluencyScore:    avg('fluencyScore'),
        confidenceScore: avg('confidenceScore'),
        relevanceScore:  avg('relevanceScore'),
        technicalScore:  avg('technicalScore'),
        grammarScore:    avg('grammarScore'),
        overallScore:    avg('overallScore'),
      },
    });

    logger.info(`SkillSnapshot saved for session: ${sessionId}`);
  } catch (err) {
    logger.error('captureSkillSnapshot error:', err);
  }
}

// ── getSkillTimeline ────────────────────────────────────────────────────────

/**
 * Returns skill timeline data for the analytics page.
 * Each entry = one completed session's averaged scores.
 */
export async function getSkillTimeline(userId: string, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snapshots = await (prisma as any).skillSnapshot.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      clarityScore:    true,
      fluencyScore:    true,
      confidenceScore: true,
      relevanceScore:  true,
      technicalScore:  true,
      grammarScore:    true,
      overallScore:    true,
      session: { select: { title: true, targetRole: true } },
    },
  });

  return snapshots.map((s: any) => ({
    date:         s.date,
    label:        new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sessionTitle: s.session?.title || 'Session',
    clarity:      s.clarityScore,
    fluency:      s.fluencyScore,
    confidence:   s.confidenceScore,
    relevance:    s.relevanceScore,
    technical:    s.technicalScore,
    grammar:      s.grammarScore,
    overall:      s.overallScore,
  }));
}

// ── getLatestSkillDelta ─────────────────────────────────────────────────────

/**
 * Returns the most recent snapshot diff vs the previous one.
 * Used by the frontend to show "+0.4 ↑ since last session" badges.
 */
export async function getLatestSkillDelta(userId: string) {
  const last2 = await (prisma as any).skillSnapshot.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 2,
  });

  if (last2.length < 2) return null;

  const [latest, prev] = last2;
  const delta = (key: string): number | null => {
    const a = latest[key] as number | null;
    const b = prev[key]   as number | null;
    if (a == null || b == null) return null;
    return parseFloat((a - b).toFixed(2));
  };

  return {
    clarity:    delta('clarityScore'),
    fluency:    delta('fluencyScore'),
    confidence: delta('confidenceScore'),
    technical:  delta('technicalScore'),
    overall:    delta('overallScore'),
  };
}
