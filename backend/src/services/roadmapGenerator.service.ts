import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const mlClient = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 60000,
});

export const generateRoadmap = async (
  targetRole: string,
  weakSkills: string[]
) => {
  try {
    const { data } = await mlClient.post('/internal/generate-roadmap', {
      targetRole,
      weakSkills,
    });
    logger.info(`Generated roadmap for ${targetRole}`);
    return data.roadmap;
  } catch (err) {
    logger.error('Roadmap generation failed:', err);
    throw new Error('Failed to generate roadmap');
  }
};

export const generateNodeInfo = async (
  skillLabel: string,
  targetRole: string
) => {
  try {
    const { data } = await mlClient.post('/internal/generate-node-info', {
      skillLabel,
      targetRole,
    });
    logger.info(`Generated node info for ${skillLabel}`);
    return data.info;
  } catch (err) {
    logger.error('Node info generation failed:', err);
    throw new Error('Failed to generate node info');
  }
};
