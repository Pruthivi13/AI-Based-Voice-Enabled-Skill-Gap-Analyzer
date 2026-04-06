/**
 * resources.service.ts
 *
 * Derives the user's weak areas from their most recent completed sessions,
 * then calls the ML service (Serper) to fetch fresh courses for each category.
 *
 * Category logic:
 *   clarityScore / fluencyScore < 7    → Fluency resources
 *   confidenceScore < 7                → Confidence resources
 *   technicalScore < 7                 → Technical resources
 *   relevanceScore / grammarScore < 7  → Communication resources
 *
 * If no sessions exist, returns a balanced default set across all categories.
 */
import axios from 'axios';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const mlClient = axios.create({ baseURL: env.ML_SERVICE_URL, timeout: 30000 });

export type ResourceCategory = 'Technical' | 'Communication' | 'Fluency' | 'Confidence';

const CATEGORY_QUERIES: Record<ResourceCategory, string[]> = {
  Technical:     ['programming fundamentals', 'system design', 'data structures algorithms'],
  Communication: ['communication skills', 'presentation skills', 'business english'],
  Fluency:       ['public speaking', 'speech clarity', 'reduce filler words speaking'],
  Confidence:    ['interview confidence', 'body language interview', 'professional presence'],
};

async function fetchCoursesForQuery(query: string, category: ResourceCategory) {
  try {
    const { data } = await mlClient.post('/internal/fetch-courses', {
      targetRole: query,
      maxCourses: 4,
    });
    return (data.courses ?? []).map((c: any) => ({ ...c, category }));
  } catch (err) {
    logger.error(`Failed to fetch courses for query "${query}":`, err);
    return [];
  }
}

async function deriveWeakCategories(userId: string): Promise<ResourceCategory[]> {
  // Get last 5 completed sessions with analyses
  const sessions = await prisma.interviewSession.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      responses: {
        include: { analysis: true },
      },
    },
  });

  if (sessions.length === 0) {
    // No history — return all categories balanced
    return ['Technical', 'Communication', 'Fluency', 'Confidence'];
  }

  // Aggregate scores across all analyses
  const totals = {
    technical:     { sum: 0, count: 0 },
    communication: { sum: 0, count: 0 },
    fluency:       { sum: 0, count: 0 },
    confidence:    { sum: 0, count: 0 },
  };

  for (const session of sessions) {
    for (const response of session.responses) {
      const a = response.analysis;
      if (!a) continue;
      if (a.technicalScore   != null) { totals.technical.sum     += a.technicalScore;   totals.technical.count++;     }
      if (a.clarityScore     != null) { totals.communication.sum += a.clarityScore;     totals.communication.count++; }
      if (a.fluencyScore     != null) { totals.fluency.sum       += a.fluencyScore;     totals.fluency.count++;       }
      if (a.confidenceScore  != null) { totals.confidence.sum    += a.confidenceScore;  totals.confidence.count++;    }
    }
  }

  // Categories with average below 7 are "weak"
  const weak: ResourceCategory[] = [];
  const THRESHOLD = 7;

  const avg = (k: keyof typeof totals) =>
    totals[k].count > 0 ? totals[k].sum / totals[k].count : 10;

  if (avg('technical')     < THRESHOLD) weak.push('Technical');
  if (avg('communication') < THRESHOLD) weak.push('Communication');
  if (avg('fluency')       < THRESHOLD) weak.push('Fluency');
  if (avg('confidence')    < THRESHOLD) weak.push('Confidence');

  // Always include at least 2 categories
  if (weak.length === 0) return ['Technical', 'Communication'];
  if (weak.length === 1) {
    // Add the next weakest as well
    const scores: [ResourceCategory, number][] = [
      ['Technical',     avg('technical')],
      ['Communication', avg('communication')],
      ['Fluency',       avg('fluency')],
      ['Confidence',    avg('confidence')],
    ];
    scores.sort((a, b) => a[1] - b[1]);
    const second = scores.find(([cat]) => cat !== weak[0]);
    if (second) weak.push(second[0]);
  }

  return weak;
}

export const getPersonalizedResources = async (userId: string) => {
  const weakCategories = await deriveWeakCategories(userId);
  logger.info(`Weak categories for user ${userId}: ${weakCategories.join(', ')}`);

  // Fetch 3–4 courses per weak category in parallel
  const fetchPromises = weakCategories.flatMap((cat) => {
    // Pick one representative query per category
    const queries = CATEGORY_QUERIES[cat];
    const query   = queries[Math.floor(Math.random() * queries.length)];
    return fetchCoursesForQuery(query, cat);
  });

  const results = await Promise.all(fetchPromises);
  const courses = results.flat();

  // De-duplicate by URL
  const seen  = new Set<string>();
  const unique = courses.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  return {
    resources: unique,
    weakCategories,
    totalCount: unique.length,
  };
};

// ── Static fallback resources (shown while dynamic ones load) ────────────────
export const getStaticResources = async () => [
  {
    id: 'static_1', title: 'Mastering the STAR Interview Method',
    description: 'Comprehensive guide to structuring behavioral answers using Situation, Task, Action, Result.',
    category: 'Communication', difficulty: 'Beginner',
    url: 'https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-interview-response-technique',
    thumbnail: '', platform: 'Article', price: 'Free', rating: null, students: null,
    color: '#f472b6', gradientFrom: '#4a0030', gradientTo: '#f472b6',
  },
  {
    id: 'static_2', title: 'System Design Interview Prep',
    description: 'Deep dive into scalability, load balancing, microservices, and distributed systems.',
    category: 'Technical', difficulty: 'Advanced',
    url: 'https://github.com/donnemartin/system-design-primer',
    thumbnail: '', platform: 'Guide', price: 'Free', rating: null, students: null,
    color: '#38bdf8', gradientFrom: '#001f5b', gradientTo: '#38bdf8',
  },
  {
    id: 'static_3', title: 'Public Speaking Masterclass',
    description: 'Practical exercises to eliminate filler words and improve speech clarity.',
    category: 'Fluency', difficulty: 'Intermediate',
    url: 'https://www.coursera.org/learn/public-speaking',
    thumbnail: '', platform: 'Coursera', price: 'Free / Audit', rating: '4.7', students: null,
    color: '#4ade80', gradientFrom: '#001b30', gradientTo: '#4ade80',
  },
  {
    id: 'static_4', title: 'Building Confidence for Interviews',
    description: 'Mental frameworks and power techniques to walk into any interview fully confident.',
    category: 'Confidence', difficulty: 'Beginner',
    url: 'https://www.linkedin.com/learning/topics/interview-preparation',
    thumbnail: '', platform: 'LinkedIn Learning', price: 'Check site', rating: null, students: null,
    color: '#fbbf24', gradientFrom: '#1a0800', gradientTo: '#fbbf24',
  },
];
