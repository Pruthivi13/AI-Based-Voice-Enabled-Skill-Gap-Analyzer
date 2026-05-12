import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const mlClient = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 30000,
});

const toFormValues = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {}
    return [trimmed];
  }
  return [String(value).trim()].filter(Boolean);
};

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
    const form = new FormData();
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

    toFormValues(payload.expectedKeywords).forEach((keyword) => {
      form.append('expected_keywords', keyword);
    });
    toFormValues(payload.expectedKeyPoints).forEach((point) => {
      form.append('expected_key_points', point);
    });
    if (payload.idealAnswer) {
      form.append('ideal_answer', payload.idealAnswer);
    }

    const { data } = await mlClient.post('/api/analyze-answer', form, {
      headers: form.getHeaders(),
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
