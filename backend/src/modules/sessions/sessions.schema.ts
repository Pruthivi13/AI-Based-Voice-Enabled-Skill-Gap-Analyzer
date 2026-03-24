import { z } from 'zod';

export const createSessionSchema = z.object({
  interviewType: z.enum(['TECHNICAL', 'HR', 'COMMUNICATION', 'MIXED']),
  targetRole: z.string().min(1).max(100),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  experienceLevel: z
    .enum(['STUDENT', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR'])
    .optional(),
  questionCount: z.number().int().min(1).max(10),
  jobDescription: z.string().max(10000).optional(),
});
