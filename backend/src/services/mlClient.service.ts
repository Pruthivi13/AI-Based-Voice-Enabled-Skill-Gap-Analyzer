import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const mlClient = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 30000,
});

export const transcribeAudio = async (audioUrl: string, responseId: string) => {
  try {
    const { data } = await mlClient.post('/internal/transcribe', {
      audioUrl,
      responseId,
    });
    logger.info(`Transcription complete for response: ${responseId}`);
    return data;
  } catch (err) {
    logger.error('ML transcribe failed:', err);
    return null;
  }
};

export const analyzeResponse = async (
  responseId: string,
  transcript: string
) => {
  try {
    const { data } = await mlClient.post('/internal/analyze-response', {
      responseId,
      transcript,
    });
    logger.info(`Analysis complete for response: ${responseId}`);
    return data;
  } catch (err) {
    logger.error('ML analyze failed:', err);
    return null;
  }
};

export const generateReport = async (sessionId: string) => {
  try {
    const { data } = await mlClient.post('/internal/generate-report', {
      sessionId,
    });
    logger.info(`Report generated for session: ${sessionId}`);
    return data;
  } catch (err) {
    logger.error('ML report generation failed:', err);
    return null;
  }
};
