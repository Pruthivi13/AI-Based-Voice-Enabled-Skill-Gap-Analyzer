import { Response, NextFunction } from 'express';
import admin from '../config/firebaseAdmin';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';

export const authMiddleware = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'No token provided.',
      });
    }

    const token = header.split(' ')[1];

    // Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(token);

    // Find user by supabaseUid first
    let user = await prisma.user.findUnique({
      where: { supabaseUid: decoded.uid },
    });

    // If not found by uid, try finding by email
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: decoded.email! },
      });

      if (user) {
        // Update existing user's supabaseUid to Firebase uid
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            supabaseUid: decoded.uid,
            emailVerified: decoded.email_verified || false,
          },
        });
        logger.info(`Updated existing user with Firebase uid: ${user.email}`);
      } else {
        // Brand new user — create record
        user = await prisma.user.create({
          data: {
            supabaseUid: decoded.uid,
            email: decoded.email!,
            fullName: decoded.name || null,
            emailVerified: decoded.email_verified || false,
            profile: { create: {} },
            settings: { create: {} },
          },
        });
        logger.info(`New user created: ${user.email}`);
      }
    } else {
      // Update emailVerified if changed
      if (user.emailVerified !== decoded.email_verified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: decoded.email_verified || false },
        });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token.',
    });
  }
};
