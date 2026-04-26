/**
 * warmup.service.ts
 *
 * Returns a random warmup question from a curated pool.
 * Warmup questions are:
 *  - Conversational, never technical or evaluative
 *  - Designed to get the mic and voice going, not to assess
 *  - Grouped by "vibe" so we can pick seasonally or randomly
 */

export interface WarmupQuestion {
  id:       string;
  content:  string;
  category: 'life' | 'fun' | 'reflective' | 'creative';
  prompt:   string;   // coaching tip shown below the question
}

const WARMUP_POOL: WarmupQuestion[] = [
  // ── Life ─────────────────────────────────────────────────────────────────
  {
    id: 'w1', category: 'life',
    content: 'How has your morning been so far?',
    prompt:  'Just chat naturally — there is no right answer here.',
  },
  {
    id: 'w2', category: 'life',
    content: 'Tell me about the last meal you really enjoyed.',
    prompt:  'Describe it like you\'re recommending it to a friend.',
  },
  {
    id: 'w3', category: 'life',
    content: 'What\'s something small that made you smile this week?',
    prompt:  'Keep it light — this is just to warm your voice up.',
  },
  {
    id: 'w4', category: 'life',
    content: 'Describe your commute or journey to get here today.',
    prompt:  'Paint a quick picture — even a short walk counts.',
  },
  {
    id: 'w5', category: 'life',
    content: 'What have you been listening to lately — music, podcasts, anything?',
    prompt:  'Share whatever comes to mind, in as much detail as you like.',
  },
  // ── Fun ──────────────────────────────────────────────────────────────────
  {
    id: 'w6', category: 'fun',
    content: 'If you could have any superpower just for today, what would it be and why?',
    prompt:  'Have fun with this — be creative and expressive!',
  },
  {
    id: 'w7', category: 'fun',
    content: 'What\'s a movie or show you\'ve watched recently that surprised you?',
    prompt:  'No spoilers needed — just what made it stand out.',
  },
  {
    id: 'w8', category: 'fun',
    content: 'If you could visit anywhere in the world this weekend, where would you go?',
    prompt:  'Describe why — paint a picture with your words.',
  },
  {
    id: 'w9', category: 'fun',
    content: 'Tell me about a hobby or activity that helps you unwind.',
    prompt:  'Speak enthusiastically — let your personality come through.',
  },
  {
    id: 'w10', category: 'fun',
    content: 'What\'s the best piece of advice anyone has ever given you?',
    prompt:  'Take a breath and share it in your own words.',
  },
  // ── Reflective ───────────────────────────────────────────────────────────
  {
    id: 'w11', category: 'reflective',
    content: 'What\'s one thing you\'re looking forward to this week?',
    prompt:  'It can be something tiny — even a cup of coffee counts.',
  },
  {
    id: 'w12', category: 'reflective',
    content: 'Describe a skill you\'ve been casually learning on the side.',
    prompt:  'No pressure — curiosity is the only requirement.',
  },
  {
    id: 'w13', category: 'reflective',
    content: 'What does a perfect lazy Sunday look like for you?',
    prompt:  'Be descriptive — details make answers memorable.',
  },
  // ── Creative ─────────────────────────────────────────────────────────────
  {
    id: 'w14', category: 'creative',
    content: 'If your week were a weather forecast, what would it be and why?',
    prompt:  'Metaphors welcome — express yourself freely.',
  },
  {
    id: 'w15', category: 'creative',
    content: 'Describe your ideal morning routine — real or imaginary.',
    prompt:  'Use vivid details and speak at a natural, comfortable pace.',
  },
];

export function getRandomWarmupQuestion(): WarmupQuestion {
  const idx = Math.floor(Math.random() * WARMUP_POOL.length);
  return WARMUP_POOL[idx];
}

export function getWarmupQuestionById(id: string): WarmupQuestion | null {
  return WARMUP_POOL.find((q) => q.id === id) ?? null;
}
