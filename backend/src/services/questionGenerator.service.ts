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
    const { data } = await mlClient.post('/internal/generate-questions', {
      targetRole,
      experienceLevel,
      interviewType,
      questionCount,
    });
    logger.info(
      `Generated ${data.questions.length} questions for ${targetRole}`
    );
    return data.questions;
  } catch (err) {
    logger.error('Question generation failed:', err);
    throw new Error('Failed to generate questions');
  }
};
