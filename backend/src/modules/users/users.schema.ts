import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateUserSchema = z.object({
  fullName: z.string().max(120).optional(),
  profile: z
    .object({
      targetRole: z.string().optional(),
      experienceLevel: z
        .enum(['STUDENT', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR'])
        .optional(),
      preferredLanguage: z.string().max(20).optional(),
      bio: z.string().max(1000).optional(),
    })
    .optional(),
  settings: z
    .object({
      theme: z.enum(['light', 'dark']).optional(),
      sessionReminders: z.boolean().optional(),
      weeklyProgress: z.boolean().optional(),
      newResources: z.boolean().optional(),
    })
    .optional(),
});
