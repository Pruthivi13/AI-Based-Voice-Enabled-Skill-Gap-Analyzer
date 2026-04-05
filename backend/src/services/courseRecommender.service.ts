import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const mlClient = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 60000,
});

export interface Course {
  id: string;
  title: string;
  url: string;
  platform: string;
  thumbnail: string;
  price: string;
  rating: string | null;
  students: string | null;
  description: string;
  color: string;
}

export const fetchCoursesFromML = async (
  targetRole: string,
  maxCourses = 12
): Promise<Course[]> => {
  try {
    const { data } = await mlClient.post('/internal/fetch-courses', {
      targetRole,
      maxCourses,
    });
    logger.info(`Fetched ${data.courses?.length ?? 0} courses for: ${targetRole}`);
    return data.courses ?? [];
  } catch (err) {
    logger.error('Course fetch from ML failed:', err);
    return [];
  }
};
