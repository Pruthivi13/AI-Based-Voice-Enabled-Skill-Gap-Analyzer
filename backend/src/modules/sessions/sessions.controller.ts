import { Response, NextFunction } from 'express';
import * as SessionsService from './sessions.service';
import { createSessionSchema } from './sessions.schema';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { logger } from '../../utils/logger';
import { buildStoredQuestionRubric } from '../../utils/questionRubric';

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
        const rubric = buildStoredQuestionRubric(q);
        return prisma.question.upsert({
          where: { id: q.id },
          update: {
            hints: rubric.hints as any,
            expectedKeywords: rubric.expectedKeywords as any,
            referenceAnswer: rubric.referenceAnswer,
            ...(rubric.role ? { role: rubric.role } : {}),
          },
          create: {
            id: q.id,
            content: q.content,
            category: (q.category || interviewType) as any,
            difficulty: (q.difficulty || difficulty) as any,
            timeLimitSeconds: q.timeLimitSeconds || 120,
            hints: rubric.hints as any,
            expectedKeywords: rubric.expectedKeywords as any,
            referenceAnswer: rubric.referenceAnswer,
            ...(rubric.role ? { role: rubric.role } : {}),
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
        questionsJson: questions as any,
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

export const pauseSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { pauseSession: svc } = await import('./sessions.service');
    const result = await svc(req.user.id, req.params.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const resumeSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeSession: svc } = await import('./sessions.service');
    const result = await svc(req.user.id, req.params.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const createTargetedSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { generateQuestionsFromAI } = await import('../../services/questionGenerator.service');
    const prismaDb = (await import('../../config/prisma')).default;

    const { interviewType, targetRole, difficulty, questionCount, focusAreas = [] } = req.body;

    const focusedRole = focusAreas.length > 0
      ? `${targetRole} (focus on: ${focusAreas.join(', ')})`
      : targetRole;

    let questions: any[];
    try {
      questions = await generateQuestionsFromAI(focusedRole, 'JUNIOR', interviewType, Number(questionCount) || 5);
    } catch {
      questions = await (prismaDb as any).question.findMany({
        where: { isActive: true, category: interviewType as any },
        take: Number(questionCount) || 5,
      });
    }

    const savedQuestions = await Promise.all(
      questions.map(async (q: any) => {
        const rubric = buildStoredQuestionRubric(q);
        return (prismaDb as any).question.upsert({
          where: { id: q.id },
          update: {
            hints: rubric.hints as any,
            expectedKeywords: rubric.expectedKeywords as any,
            referenceAnswer: rubric.referenceAnswer,
            ...(rubric.role ? { role: rubric.role } : {}),
          },
          create: {
            id: q.id,
            content: q.content,
            category: (q.category || interviewType) as any,
            difficulty: (q.difficulty || difficulty) as any,
            timeLimitSeconds: q.timeLimitSeconds || 120,
            hints: rubric.hints as any,
            expectedKeywords: rubric.expectedKeywords as any,
            referenceAnswer: rubric.referenceAnswer,
            ...(rubric.role ? { role: rubric.role } : {}),
            isActive: true,
          },
        })
      })
    );

    const session = await (prismaDb as any).interviewSession.create({
      data: {
        userId:        req.user.id,
        interviewType: interviewType as any,
        targetRole,
        difficulty:    difficulty as any,
        questionCount: savedQuestions.length,
        title: `Targeted: ${focusAreas.join(' & ') || targetRole} Practice`,
        questionsJson: savedQuestions as any,
      },
    });

    return sendSuccess(res, { sessionId: session.id, status: session.status, questions: savedQuestions, isTargeted: true, focusAreas }, 201);
  } catch (err) {
    next(err);
  }
};
