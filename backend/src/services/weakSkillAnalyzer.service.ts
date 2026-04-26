/**
 * weakSkillAnalyzer.service.ts
 *
 * Scans the last N SkillSnapshots for a user and identifies:
 *  - Skills persistently below threshold
 *  - Consecutive weak sessions count
 *  - Trend (declining / flat / improving)
 *  - Auto-configured session parameters to target the weakness
 */
import prisma from '../config/prisma';
import { logger } from '../utils/logger';

export type SkillKey =
  | 'clarityScore'
  | 'fluencyScore'
  | 'confidenceScore'
  | 'technicalScore'
  | 'grammarScore'
  | 'relevanceScore'
  | 'overallScore';

export interface WeakSkill {
  key: SkillKey;
  label: string;
  avgScore: number;
  consecutiveWeakSessions: number;
  trend: 'declining' | 'flat' | 'improving';
  urgency: 'critical' | 'high' | 'medium';
  message: string;
  emoji: string;
  suggestedInterviewType: 'TECHNICAL' | 'HR' | 'COMMUNICATION' | 'MIXED';
  suggestedFocusPrompt: string;
}

export interface TargetedPrescription {
  weakSkills: WeakSkill[];
  primaryWeakness: WeakSkill | null;
  sessionConfig: {
    interviewType: string;
    difficulty: string;
    questionCount: number;
    targetRole: string;
    focusAreas: string[];
    prescriptionTitle: string;
    prescriptionSubtitle: string;
  } | null;
  hasEnoughData: boolean;
  snapshotCount: number;
}

const WEAK_THRESHOLD   = 6.5;
const SESSIONS_TO_SCAN = 5;

const SKILL_META: Record<SkillKey, {
  label: string;
  emoji: string;
  interviewType: 'TECHNICAL' | 'HR' | 'COMMUNICATION' | 'MIXED';
  focusPrompt: string;
}> = {
  technicalScore:  { label: 'Technical Depth', emoji: '⚙️',  interviewType: 'TECHNICAL',    focusPrompt: 'Focus on explaining technical concepts clearly with examples' },
  confidenceScore: { label: 'Confidence',       emoji: '💪',  interviewType: 'HR',           focusPrompt: 'Use assertive language; avoid hedging phrases like "I think maybe"' },
  clarityScore:    { label: 'Clarity',           emoji: '🎯',  interviewType: 'COMMUNICATION', focusPrompt: 'Structure answers with a clear beginning, middle, and end' },
  fluencyScore:    { label: 'Fluency',           emoji: '🗣️', interviewType: 'COMMUNICATION', focusPrompt: 'Speak at a measured pace; reduce filler words like "um" and "uh"' },
  grammarScore:    { label: 'Grammar',           emoji: '📝',  interviewType: 'COMMUNICATION', focusPrompt: 'Use complete sentences and avoid run-on responses' },
  relevanceScore:  { label: 'Relevance',         emoji: '🎯',  interviewType: 'MIXED',        focusPrompt: 'Stay on topic; directly answer what is asked before elaborating' },
  overallScore:    { label: 'Overall',           emoji: '📊',  interviewType: 'MIXED',        focusPrompt: 'Focus on balanced improvement across all areas' },
};

function computeTrend(scores: (number | null)[]): 'declining' | 'flat' | 'improving' {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length < 2) return 'flat';
  const half     = Math.floor(valid.length / 2);
  const firstAvg = valid.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const lastAvg  = valid.slice(-half).reduce((a, b) => a + b, 0) / half;
  const diff = lastAvg - firstAvg;
  if (diff < -0.3) return 'declining';
  if (diff > 0.3)  return 'improving';
  return 'flat';
}

function buildUrgencyMessage(label: string, consecutive: number, avg: number, trend: 'declining' | 'flat' | 'improving'): { urgency: 'critical' | 'high' | 'medium'; message: string } {
  if (consecutive >= 4 || (consecutive >= 3 && trend === 'declining')) {
    return { urgency: 'critical', message: `Your ${label} has been below ${WEAK_THRESHOLD} for ${consecutive} sessions in a row${trend === 'declining' ? ' and still declining' : ''} — this needs immediate attention.` };
  }
  if (consecutive >= 2) {
    return { urgency: 'high', message: `Your ${label} (avg ${avg.toFixed(1)}/10) has been weak for ${consecutive} consecutive sessions — a targeted session will help.` };
  }
  return { urgency: 'medium', message: `Your ${label} scored below ${WEAK_THRESHOLD} recently — worth practicing before it becomes a pattern.` };
}

export async function analyzeWeakSkills(userId: string): Promise<TargetedPrescription> {
  try {
    const snapshots = await (prisma as any).skillSnapshot.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: SESSIONS_TO_SCAN,
      include: { session: { select: { targetRole: true, title: true } } },
    });

    if (snapshots.length < 2) {
      return { weakSkills: [], primaryWeakness: null, sessionConfig: null, hasEnoughData: false, snapshotCount: snapshots.length };
    }

    const ordered = [...snapshots].reverse();

    const skillKeys: SkillKey[] = ['technicalScore','confidenceScore','clarityScore','fluencyScore','grammarScore','relevanceScore'];
    const weakSkills: WeakSkill[] = [];

    for (const key of skillKeys) {
      const scores   = ordered.map((s: any) => s[key] as number | null);
      const valid    = scores.filter((s): s is number => s !== null);
      if (valid.length === 0) continue;

      const avg = valid.reduce((a, b) => a + b, 0) / valid.length;

      let consecutive = 0;
      for (const snap of snapshots) {
        const val = snap[key] as number | null;
        if (val !== null && val < WEAK_THRESHOLD) consecutive++;
        else break;
      }

      if (avg >= WEAK_THRESHOLD && consecutive === 0) continue;

      const trend = computeTrend(scores);
      const meta  = SKILL_META[key];
      const { urgency, message } = buildUrgencyMessage(meta.label, consecutive, avg, trend);

      weakSkills.push({ key, label: meta.label, avgScore: parseFloat(avg.toFixed(2)), consecutiveWeakSessions: consecutive, trend, urgency, message, emoji: meta.emoji, suggestedInterviewType: meta.interviewType, suggestedFocusPrompt: meta.focusPrompt });
    }

    weakSkills.sort((a, b) => {
      const r = { critical: 0, high: 1, medium: 2 };
      const ur = r[a.urgency] - r[b.urgency];
      return ur !== 0 ? ur : b.consecutiveWeakSessions - a.consecutiveWeakSessions;
    });

    const primaryWeakness = weakSkills[0] ?? null;
    let sessionConfig = null;

    if (primaryWeakness) {
      const topTwo = weakSkills.slice(0, 2);
      const role   = snapshots[0]?.session?.targetRole || 'Software Engineer';
      const types  = [...new Set(topTwo.map(w => w.suggestedInterviewType))];
      const interviewType = types.length === 1 ? types[0] : 'MIXED';

      sessionConfig = {
        interviewType,
        difficulty: primaryWeakness.urgency === 'critical' ? 'MEDIUM' : 'HARD',
        questionCount: 5,
        targetRole: role,
        focusAreas: topTwo.map(w => w.label),
        prescriptionTitle: `Fix your ${primaryWeakness.label}`,
        prescriptionSubtitle: topTwo.map(w => `${w.emoji} ${w.label} (${w.avgScore.toFixed(1)}/10)`).join('  ·  '),
      };
    }

    return { weakSkills, primaryWeakness, sessionConfig, hasEnoughData: true, snapshotCount: snapshots.length };
  } catch (err) {
    logger.error('analyzeWeakSkills error:', err);
    return { weakSkills: [], primaryWeakness: null, sessionConfig: null, hasEnoughData: false, snapshotCount: 0 };
  }
}
