import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
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
