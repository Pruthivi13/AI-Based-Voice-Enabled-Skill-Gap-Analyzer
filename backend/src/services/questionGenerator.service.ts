import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const mlClient = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 30000,
});

export const generateQuestionsFromAI = async (
  targetRole: string,
  experienceLevel: string,
  interviewType: string,
  questionCount: number
) => {
  try {
    const { data } = await mlClient.post(
      '/internal/generate-questions',
      {
        targetRole,
        experienceLevel,
        interviewType,
        questionCount,
        _ts: Date.now(), // cache-buster — forces fresh generation every call
      },
      {
        timeout: 60000, // increase to 60s to allow retries in Python
      }
    );
    logger.info(
      `Generated ${data.questions.length} questions for ${targetRole}`
    );
    return data.questions;
  } catch (err) {
    logger.error(`Question generation failed for role "${targetRole}":`, err);
    throw new Error(`Failed to generate questions for "${targetRole}"`);
  }
};
