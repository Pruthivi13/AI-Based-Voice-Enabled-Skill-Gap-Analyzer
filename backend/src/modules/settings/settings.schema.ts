import { z } from 'zod';

export const updateSettingsSchema = z.object({
  name: z.string().max(120).optional(),
  preferredRole: z.string().max(100).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  notifications: z
    .object({
      sessionReminders: z.boolean().optional(),
      weeklyProgress: z.boolean().optional(),
      newResources: z.boolean().optional(),
    })
    .optional(),
});
