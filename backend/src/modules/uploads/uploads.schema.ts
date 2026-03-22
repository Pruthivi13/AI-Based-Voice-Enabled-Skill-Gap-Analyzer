import { z } from 'zod';

export const uploadAudioSchema = z.object({
  answerOrder: z.number().int().min(1).optional(),
  durationSeconds: z.number().int().min(1).optional(),
});

export const ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/wav',
  'audio/mpeg',
  'audio/ogg',
];

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
