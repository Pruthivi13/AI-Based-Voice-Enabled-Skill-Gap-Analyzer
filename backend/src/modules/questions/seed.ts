import prisma from '../../config/prisma';

const questions = [
  // TECHNICAL - EASY
  {
    content:
      'What is the difference between let, const, and var in JavaScript?',
    category: 'TECHNICAL' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },
  {
    content: 'What is the virtual DOM in React?',
    category: 'TECHNICAL' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },
  {
    content: 'What is the difference between == and === in JavaScript?',
    category: 'TECHNICAL' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },
  {
    content: 'What is a REST API?',
    category: 'TECHNICAL' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },
  {
    content: 'What is the difference between GET and POST requests?',
    category: 'TECHNICAL' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },

  // TECHNICAL - MEDIUM
  {
    content: 'Explain how React hooks work and give examples.',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content: 'What is the difference between REST and GraphQL?',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content: 'How does async/await work in JavaScript?',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content: 'Explain the concept of closures in JavaScript.',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content: 'How do you handle state management in a large React application?',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },

  // TECHNICAL - HARD
  {
    content: 'Design a scalable URL shortener system.',
    category: 'TECHNICAL' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 300,
  },
  {
    content: 'Explain the CAP theorem and its implications.',
    category: 'TECHNICAL' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 300,
  },
  {
    content: 'How would you optimize a slow database query?',
    category: 'TECHNICAL' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 300,
  },

  // HR - EASY
  {
    content: 'Tell me about yourself.',
    category: 'HR' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },
  {
    content: 'Why do you want to work at this company?',
    category: 'HR' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },
  {
    content: 'What are your strengths and weaknesses?',
    category: 'HR' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },
  {
    content: 'Where do you see yourself in 5 years?',
    category: 'HR' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },

  // HR - MEDIUM
  {
    content: 'Describe a time you resolved a conflict within your team.',
    category: 'HR' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content: 'Tell me about a time you failed and what you learned.',
    category: 'HR' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content: 'How do you handle working under pressure or tight deadlines?',
    category: 'HR' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content: 'Describe a situation where you showed leadership.',
    category: 'HR' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },

  // HR - HARD
  {
    content:
      'Tell me about a time you disagreed with your manager and how you handled it.',
    category: 'HR' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 240,
  },
  {
    content: 'Describe the most challenging project you have worked on.',
    category: 'HR' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 240,
  },

  // COMMUNICATION - EASY
  {
    content:
      'How do you explain a complex technical concept to a non-technical person?',
    category: 'COMMUNICATION' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },
  {
    content:
      'How do you prefer to communicate with your team — email, chat, or meetings?',
    category: 'COMMUNICATION' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
  },

  // COMMUNICATION - MEDIUM
  {
    content:
      'Describe a time when miscommunication caused a problem and how you fixed it.',
    category: 'COMMUNICATION' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content: 'How do you give constructive feedback to a colleague?',
    category: 'COMMUNICATION' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },
  {
    content:
      'How do you handle a situation where stakeholders have conflicting requirements?',
    category: 'COMMUNICATION' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
  },

  // COMMUNICATION - HARD
  {
    content:
      'Describe a time you had to present a difficult decision to a large audience.',
    category: 'COMMUNICATION' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 240,
  },
  {
    content:
      'How do you ensure alignment across multiple teams on a large project?',
    category: 'COMMUNICATION' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 240,
  },
  // TECHNICAL - FRONTEND ROLE SPECIFIC - EASY
  {
    content: 'What is the difference between CSS Flexbox and Grid?',
    category: 'TECHNICAL' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
    role: 'Frontend Developer',
  },
  {
    content: 'What is the box model in CSS?',
    category: 'TECHNICAL' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
    role: 'Frontend Developer',
  },
  {
    content: 'What are React props and state?',
    category: 'TECHNICAL' as const,
    difficulty: 'EASY' as const,
    timeLimitSeconds: 120,
    role: 'Frontend Developer',
  },

  // TECHNICAL - FRONTEND ROLE SPECIFIC - MEDIUM
  {
    content: 'How does the React component lifecycle work?',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
    role: 'Frontend Developer',
  },
  {
    content: 'What is code splitting and how do you implement it in React?',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
    role: 'Frontend Developer',
  },
  {
    content:
      'Explain the difference between controlled and uncontrolled components in React.',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
    role: 'Frontend Developer',
  },
  {
    content: 'What is CSS specificity and how does it work?',
    category: 'TECHNICAL' as const,
    difficulty: 'MEDIUM' as const,
    timeLimitSeconds: 180,
    role: 'Frontend Developer',
  },

  // TECHNICAL - FRONTEND ROLE SPECIFIC - HARD
  {
    content:
      'How would you optimize the performance of a slow React application?',
    category: 'TECHNICAL' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 300,
    role: 'Frontend Developer',
  },
  {
    content: 'Explain how browser rendering works from HTML parsing to paint.',
    category: 'TECHNICAL' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 300,
    role: 'Frontend Developer',
  },
  {
    content:
      'How would you implement lazy loading and infinite scroll in React?',
    category: 'TECHNICAL' as const,
    difficulty: 'HARD' as const,
    timeLimitSeconds: 300,
    role: 'Frontend Developer',
  },
];

export const seedQuestions = async () => {
  const count = await prisma.question.count();
  if (count > 0) {
    console.log('Questions already seeded, skipping...');
    return;
  }

  await prisma.question.createMany({ data: questions });
  console.log(`✅ Seeded ${questions.length} questions`);
};
