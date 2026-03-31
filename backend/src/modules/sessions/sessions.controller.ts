import { Response, NextFunction } from 'express';
import * as SessionsService from './sessions.service';
import { createSessionSchema } from './sessions.schema';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { logger } from '../../utils/logger';

export const createSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 'VALIDATION_ERROR', parsed.error.message, 400);
    const result = await SessionsService.createSession(
      req.user.id,
      parsed.data
    );
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};

export const getSessions = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const result = await SessionsService.getSessions(req.user.id, page, limit);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getSessionById = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await SessionsService.getSessionById(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, session);
  } catch (err) {
    next(err);
  }
};

export const getSessionQuestions = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const questions = await SessionsService.getSessionQuestions(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, questions);
  } catch (err) {
    next(err);
  }
};

export const finishSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await SessionsService.finishSession(
      req.user.id,
      req.params.id
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const retryQuestion = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { retryQuestion: retryService } = await import('./retry.service');
    const result = await retryService(
      req.user.id,
      req.params.id,
      req.params.qid
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const createSessionWithResume = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { extractTextFromPDF, generateQuestionsFromResume } = await import(
      '../../services/resumeParser.service'
    );

    const {
      interviewType,
      targetRole,
      difficulty,
      experienceLevel,
      questionCount,
    } = req.body;

    let questions;

    if (req.file) {
      // Extract text from uploaded PDF
      const resumeText = await extractTextFromPDF(req.file.buffer);
      logger.info(`Extracted ${resumeText.length} chars from resume`);

      // Generate resume-tailored questions
      questions = await generateQuestionsFromResume(
        resumeText,
        targetRole,
        experienceLevel || 'JUNIOR',
        interviewType,
        Number(questionCount)
      );
    } else {
      // No resume — fall back to regular generation
      const { generateQuestionsFromAI } = await import(
        '../../services/questionGenerator.service'
      );
      questions = await generateQuestionsFromAI(
        targetRole,
        experienceLevel || 'JUNIOR',
        interviewType,
        Number(questionCount)
      );
    }

    // Create session in DB
    const prisma = (await import('../../config/prisma')).default;

    // Save AI-generated questions to the DB
    const savedQuestions = await Promise.all(
      questions.map(async (q: any) => {
        return prisma.question.upsert({
          where: { id: q.id },
          update: {},
          create: {
            id: q.id,
            content: q.content,
            category: (q.category || interviewType) as any,
            difficulty: (q.difficulty || difficulty) as any,
            timeLimitSeconds: q.timeLimitSeconds || 120,
            isActive: true,
          },
        });
      })
    );
    questions = savedQuestions;

    const session = await prisma.interviewSession.create({
      data: {
        userId: req.user.id,
        interviewType,
        targetRole,
        difficulty,
        experienceLevel,
        questionCount: questions.length,
        title: `${targetRole} ${interviewType} Interview`,
      },
    });

    return sendSuccess(res, {
      sessionId: session.id,
      status: session.status,
      questions,
      resumeUsed: !!req.file,
    }, 201);
  } catch (err) {
    next(err);
  }
};
