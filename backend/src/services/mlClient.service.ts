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
  transcript: string,
  context?: {
    questionText?: string;
    audioUrl?: string | null;
    expectedKeywords?: unknown;
    expectedKeyPoints?: unknown;
    idealAnswer?: string | null;
  }
) => {
  try {
    const { data } = await mlClient.post('/internal/analyze-response', {
      responseId,
      transcript,
      questionText: context?.questionText,
      audioUrl: context?.audioUrl,
      expectedKeywords: context?.expectedKeywords,
      expectedKeyPoints: context?.expectedKeyPoints,
      idealAnswer: context?.idealAnswer,
    });
    logger.info(`Analysis complete for response: ${responseId}`);
    return data;
  } catch (err) {
    logger.error('ML analyze failed:', err);
    return null;
  }
};

export const analyzeAnswerPipeline = async (payload: {
  responseId: string;
  userId: string;
  questionId: string;
  questionText: string;
  transcript: string;
  audioUrl?: string | null;
  expectedKeywords?: unknown;
  expectedKeyPoints?: unknown;
  idealAnswer?: string | null;
}) => {
  try {
    const form = new URLSearchParams();
    form.append('response_id', payload.responseId);
    form.append('user_id', payload.userId);
    form.append('question_id', payload.questionId);
    form.append('question_text', payload.questionText);
    if (payload.transcript) {
      form.append('transcript', payload.transcript);
    }
    if (payload.audioUrl) {
      form.append('audio_url', payload.audioUrl);
    }

    if (payload.expectedKeywords) {
      form.append('expected_keywords', JSON.stringify(payload.expectedKeywords));
    }
    if (payload.expectedKeyPoints) {
      form.append('expected_key_points', JSON.stringify(payload.expectedKeyPoints));
    }
    if (payload.idealAnswer) {
      form.append('ideal_answer', payload.idealAnswer);
    }

    const { data } = await mlClient.post('/api/analyze-answer', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 90000,
    });
    logger.info(`New evaluator analysis complete for response: ${payload.responseId}`);
    return data;
  } catch (err) {
    logger.error('ML analyze-answer pipeline failed:', err);
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
