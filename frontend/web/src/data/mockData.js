/**
 * mockData.js — Realistic mock payloads for all frontend flows
 *
 * These objects mirror the expected API response shapes documented
 * in the PRD. Backend teammates should use these as a contract
 * reference when building real endpoints.
 *
 * TODO: Replace with real API responses when backend is ready.
 */

/* ── Interview Questions ── */
export const mockQuestions = [
  {
    id: 1,
    content: 'Tell me about a project where you solved a difficult problem.',
    category: 'Behavioral',
    difficulty: 'Medium',
    topic: 'Problem Solving',
    referenceAnswer: 'Describe the situation, your approach, the technologies used, and the outcome.',
  },
  {
    id: 2,
    content: 'Explain the difference between REST and GraphQL APIs.',
    category: 'Technical',
    difficulty: 'Medium',
    topic: 'API Design',
    referenceAnswer: 'REST uses resource-based endpoints; GraphQL uses a single endpoint with a query language.',
  },
  {
    id: 3,
    content: 'How do you handle state management in a large React application?',
    category: 'Technical',
    difficulty: 'Hard',
    topic: 'Frontend Architecture',
    referenceAnswer: 'Discuss Context API, Redux, Zustand, or similar; mention component composition and performance.',
  },
  {
    id: 4,
    content: 'Describe a time you resolved a conflict within your team.',
    category: 'Behavioral',
    difficulty: 'Easy',
    topic: 'Teamwork',
    referenceAnswer: 'Use STAR method: situation, task, action, result.',
  },
  {
    id: 5,
    content: 'What is the virtual DOM and how does React use it?',
    category: 'Technical',
    difficulty: 'Easy',
    topic: 'React Fundamentals',
    referenceAnswer: 'Lightweight JS representation of real DOM; React diffs virtual DOM to minimize real DOM updates.',
  },
];

/* ── Practice Summary (per-question) ── */
export const mockPracticeSummary = {
  questionId: 1,
  transcript:
    'In my final year project I developed a web application using React and Node.js. One of the biggest challenges was handling real-time data synchronization between multiple clients. I implemented a custom WebSocket layer with a fallback mechanism to ensure connectivity...',
  quickScore: 7.8,
  strengths: [
    'Clear problem description',
    'Good use of technical terminology',
    'Structured answer with context',
  ],
  improvements: [
    'Could elaborate more on the outcome and metrics',
    'Consider mentioning alternative approaches considered',
    'Add quantifiable impact of the solution',
  ],
};

/* ── Final Performance Analysis (session-level) ── */
export const mockPerformanceAnalysis = {
  sessionId: 'sess_001',
  overallScore: 7.5,
  ratingLabel: 'Good',
  dimensions: {
    communication: 8.0,
    confidence: 7.2,
    technicalKnowledge: 7.8,
    clarity: 7.5,
    fluency: 6.9,
  },
  radarData: {
    labels: ['Communication', 'Confidence', 'Technical', 'Clarity', 'Fluency'],
    values: [8.0, 7.2, 7.8, 7.5, 6.9],
  },
  aiSuggestions: [
    'Improve conciseness — some answers were longer than needed.',
    'Add more technical examples to support your claims.',
    'Reduce filler words like "um" and "you know".',
    'Structure answers using the STAR framework for behavioral questions.',
    'Practice speaking at a slightly slower pace for clarity.',
  ],
  questionBreakdown: [
    { id: 1, question: 'Tell me about a project where you solved a difficult problem.', score: 7.8, status: 'good', topic: 'Problem Solving' },
    { id: 2, question: 'Explain the difference between REST and GraphQL APIs.', score: 8.2, status: 'excellent', topic: 'API Design' },
    { id: 3, question: 'How do you handle state management in a large React application?', score: 6.5, status: 'needs-improvement', topic: 'Frontend Architecture' },
    { id: 4, question: 'Describe a time you resolved a conflict within your team.', score: 7.9, status: 'good', topic: 'Teamwork' },
    { id: 5, question: 'What is the virtual DOM and how does React use it?', score: 7.1, status: 'good', topic: 'React Fundamentals' },
  ],
};

/* ── Interview History — list of past sessions ── */
export const mockInterviewHistory = [
  {
    id: 'sess_001',
    role: 'Senior Frontend Engineer',
    category: 'Technical',
    date: '2023-10-24',
    duration: '45 mins',
    overallScore: 7.5,
    status: 'passed',
    summary: 'Demonstrated strong proficiency in React hooks and state management. System design explanations were clear, though architectural trade-offs could be explored deeper.',
  },
  {
    id: 'sess_002',
    role: 'Node.js Developer Role',
    category: 'Backend',
    date: '2023-10-18',
    duration: '60 mins',
    overallScore: 6.2,
    status: 'borderline',
    summary: 'Strong understanding of asynchronous patterns. However, struggled with database optimization questions and specific SQL indexing strategies.',
  },
  {
    id: 'sess_003',
    role: 'Cultural Fit & Leadership',
    category: 'Soft Skills',
    date: '2023-10-12',
    duration: '30 mins',
    overallScore: 9.1,
    status: 'excellent',
    summary: 'Exceptional communication and empathy. Answers used the STAR method effectively to describe conflict resolution and team mentorship.',
  },
  {
    id: 'sess_004',
    role: 'Full Stack Developer',
    category: 'Technical',
    date: '2023-10-05',
    duration: '50 mins',
    overallScore: 6.8,
    status: 'borderline',
    summary: 'Good knowledge of frontend frameworks but backend answers lacked depth on database design and API security patterns.',
  },
];

/* ── Detailed Session Review ── */
export const mockSessionReview = {
  id: 'sess_001',
  role: 'Senior Frontend Engineer',
  date: '2023-10-24',
  duration: '45 mins',
  overallScore: 7.5,
  questions: [
    {
      id: 1,
      question: 'Tell me about a project where you solved a difficult problem.',
      transcript: 'In my final year project I developed a web application using React and Node.js...',
      score: 7.8,
      feedback: 'Good structure and technical depth. Consider adding quantifiable outcomes.',
      strengths: ['Clear narrative', 'Technical terminology'],
      improvements: ['Add metrics/outcomes'],
    },
    {
      id: 2,
      question: 'Explain the difference between REST and GraphQL APIs.',
      transcript: 'REST uses resource-based endpoints with standard HTTP methods...',
      score: 8.2,
      feedback: 'Excellent comparison. You covered key differences well.',
      strengths: ['Accurate comparison', 'Good examples'],
      improvements: ['Mention trade-offs in more detail'],
    },
  ],
};

/* ── Dashboard — recent sessions ── */
export const mockRecentSessions = [
  { id: 'sess_001', title: 'Senior Software Engineer Mock', date: 'Yesterday at 2:30 PM', duration: '15 mins', score: 88 },
  { id: 'sess_002', title: 'Behavioral Questions Set B', date: 'Oct 24', duration: '10 mins', score: 72 },
];

/* ── Analytics / Insights ── */
export const mockAnalytics = {
  totalSessions: 12,
  averageScore: 7.4,
  mostImproved: 'Communication',
  focusArea: 'Technical Depth',
  scoreTrend: [
    { month: 'Jul', score: 5.8 },
    { month: 'Aug', score: 6.3 },
    { month: 'Sep', score: 6.9 },
    { month: 'Oct', score: 7.4 },
    { month: 'Nov', score: 7.8 },
    { month: 'Dec', score: 8.1 },
  ],
  weakAreas: [
    { area: 'Technical Depth', frequency: 7 },
    { area: 'Conciseness', frequency: 5 },
    { area: 'Filler Words', frequency: 4 },
    { area: 'Structure', frequency: 3 },
  ],
  competencyAverages: {
    communication: 7.8,
    confidence: 7.0,
    technical: 6.5,
    clarity: 7.3,
    fluency: 7.1,
  },
};

/* ── Learning Resources ── */
export const mockResources = [
  {
    id: 1,
    title: 'Mastering the STAR Interview Method',
    description: 'A comprehensive guide to structuring behavioral interview answers using Situation, Task, Action, Result.',
    category: 'Communication',
    difficulty: 'Beginner',
    url: '#',
  },
  {
    id: 2,
    title: 'System Design Interview Prep',
    description: 'Deep dive into scalability, load balancing, microservices, and common system design patterns.',
    category: 'Technical',
    difficulty: 'Advanced',
    url: '#',
  },
  {
    id: 3,
    title: 'Reducing Filler Words in Speech',
    description: 'Practical exercises and techniques to eliminate "um", "like", and "you know" from presentations.',
    category: 'Fluency',
    difficulty: 'Intermediate',
    url: '#',
  },
  {
    id: 4,
    title: 'React Performance Optimization',
    description: 'Learn memo, useMemo, useCallback, code splitting, and profiler-based debugging.',
    category: 'Technical',
    difficulty: 'Advanced',
    url: '#',
  },
  {
    id: 5,
    title: 'Building Confidence for Interviews',
    description: 'Mental frameworks, power posing, and preparation strategies to boost interview confidence.',
    category: 'Confidence',
    difficulty: 'Beginner',
    url: '#',
  },
  {
    id: 6,
    title: 'Data Structures & Algorithms Refresher',
    description: 'Quick review of arrays, trees, graphs, sorting, and common coding patterns.',
    category: 'Technical',
    difficulty: 'Intermediate',
    url: '#',
  },
];

/* ── Processing stages ── */
export const mockProcessingStages = [
  { id: 1, label: 'Speech Recognition', status: 'completed' },
  { id: 2, label: 'Text Analysis', status: 'completed' },
  { id: 3, label: 'Voice Feature Extraction', status: 'processing' },
  { id: 4, label: 'Skill Evaluation', status: 'pending' },
];
