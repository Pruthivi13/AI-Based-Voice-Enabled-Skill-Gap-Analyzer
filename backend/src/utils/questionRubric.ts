const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'describe',
  'difference',
  'do',
  'does',
  'explain',
  'for',
  'from',
  'give',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'me',
  'of',
  'on',
  'or',
  'tell',
  'that',
  'the',
  'their',
  'this',
  'time',
  'to',
  'use',
  'using',
  'what',
  'when',
  'where',
  'why',
  'with',
  'work',
  'would',
  'you',
  'your',
]);

export const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {}

    return trimmed
      .split(/[,;\n|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const deriveExpectedKeywords = (parts: Array<string | undefined | null>): string[] => {
  const source = parts.filter(Boolean).join(' ');
  const matches = source.match(/[A-Za-z][A-Za-z0-9+#.-]*/g) ?? [];
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const raw of matches) {
    const normalized = raw.toLowerCase();
    if (STOPWORDS.has(normalized) || normalized.length < 3 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    keywords.push(raw);
    if (keywords.length >= 10) break;
  }

  return keywords;
};

const splitReferenceAnswer = (referenceAnswer: string): string[] => {
  return referenceAnswer
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim().replace(/\.$/, ''))
    .filter(Boolean)
    .slice(0, 5);
};

export const buildStoredQuestionRubric = (question: any, fallback: { role?: string } = {}) => {
  const content = String(question?.content || '').trim();
  const role = String(question?.role || fallback.role || '').trim();
  const hints = toStringArray(question?.hints);
  const referenceAnswer = String(question?.referenceAnswer || '').trim();
  const explicitKeywords = toStringArray(question?.expectedKeywords);
  const expectedKeywords = explicitKeywords.length
    ? explicitKeywords
    : deriveExpectedKeywords([content, role, referenceAnswer, ...hints]);

  return {
    hints: hints.length ? hints : null,
    expectedKeywords: expectedKeywords.length ? expectedKeywords : null,
    referenceAnswer: referenceAnswer || null,
    ...(role ? { role } : {}),
  };
};

export const buildEvaluationRubric = (question: any, sessionTargetRole?: string) => {
  const content = String(question?.content || question?.question_text || '').trim();
  const role = String(question?.role || sessionTargetRole || '').trim();
  const hints = toStringArray(question?.hints);
  const referenceAnswer = String(question?.referenceAnswer || '').trim();
  const explicitKeywords = toStringArray(question?.expectedKeywords);
  const expectedKeywords = explicitKeywords.length
    ? explicitKeywords
    : deriveExpectedKeywords([content, role, referenceAnswer, ...hints]);
  const expectedKeyPoints = referenceAnswer
    ? splitReferenceAnswer(referenceAnswer)
    : hints.slice(0, 5);

  return {
    expectedKeywords,
    expectedKeyPoints,
    referenceAnswer,
  };
};
