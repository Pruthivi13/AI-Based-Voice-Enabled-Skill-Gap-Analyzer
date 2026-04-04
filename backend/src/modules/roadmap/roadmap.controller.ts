import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import prisma from '../../config/prisma';
import {
  generateRoadmap,
  generateNodeInfo,
} from '../../services/roadmapGenerator.service';

export const getRoadmap = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { targetRole, weakSkills } = req.body;
    const roadmap = await generateRoadmap(targetRole, weakSkills || []);
    return sendSuccess(res, roadmap);
  } catch (err) {
    next(err);
  }
};

export const getNodeInfo = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { skillLabel, targetRole } = req.body;
    const info = await generateNodeInfo(skillLabel, targetRole);
    return sendSuccess(res, info);
  } catch (err) {
    next(err);
  }
};

export const saveRoadmap = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { targetRole, nodes, edges } = req.body;
    const sessionId = req.params.id;

    // verify ownership
    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId: req.user.id },
    });
    if (!session)
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Session not found' });

    const roadmap = await prisma.roadmap.upsert({
      where: { sessionId },
      update: { targetRole, nodesJson: nodes, edgesJson: edges },
      create: { sessionId, targetRole, nodesJson: nodes, edgesJson: edges },
    });
    return sendSuccess(res, roadmap, 201);
  } catch (err) {
    next(err);
  }
};

export const getRoadmapBySession = async (req: any, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!session)
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Session not found' });

    const roadmap = await prisma.roadmap.findUnique({
      where: { sessionId: req.params.id },
    });
    if (!roadmap)
      return res.status(404).json({ error: 'NOT_FOUND', message: 'No roadmap saved yet' });

    return sendSuccess(res, {
      nodes: roadmap.nodesJson,
      edges: roadmap.edgesJson,
      targetRole: roadmap.targetRole,
    });
  } catch (err) {
    next(err);
  }
};
