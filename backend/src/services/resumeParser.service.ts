import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import * as pdfParseModule from 'pdf-parse';

const mlClient = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 60000,
});

export const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  try {
    const legacyParser =
      typeof (pdfParseModule as unknown) === 'function'
        ? (pdfParseModule as unknown as (input: Buffer) => Promise<{ text?: string }>)
        : (pdfParseModule as { default?: (input: Buffer) => Promise<{ text?: string }> }).default;

    if (legacyParser) {
      const result = await legacyParser(buffer);
      return result.text ?? '';
    }

    const parser = new pdfParseModule.PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    logger.error('PDF parsing failed:', err);
    throw new Error('Failed to extract text from PDF');
  }
};

export const generateQuestionsFromResume = async (
  resumeText: string,
  targetRole: string,
  experienceLevel: string,
  interviewType: string,
  questionCount: number
) => {
  try {
    const { data } = await mlClient.post('/internal/generate-questions-from-resume', {
      resumeText,
      targetRole,
      experienceLevel,
      interviewType,
      questionCount,
    });
    logger.info(`Generated ${data.questions.length} resume-tailored questions`);
    return data.questions;
  } catch (err) {
    logger.error('Resume question generation failed:', err);
    throw new Error('Failed to generate questions from resume');
  }
};
