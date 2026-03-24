import prisma from '../../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { ApiError } from '../../utils/apiError';

const excludePassword = (user: any) => {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const registerUser = async (
  email: string,
  password: string,
  fullName?: string
) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    throw new ApiError('EMAIL_EXISTS', 'Email already in use.', 409);

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      supabaseUid: `local_${Date.now()}`,
      emailVerified: false,
      password: hashed,
      profile: { create: {} },
      settings: { create: {} },
    },
    include: { profile: true, settings: true },
  });

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: '7d',
  });

  return { user: excludePassword(user), token };
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true, settings: true },
  });
  if (!user)
    throw new ApiError(
      'INVALID_CREDENTIALS',
      'Invalid email or password.',
      401
    );

  const valid = await bcrypt.compare(password, user.password ?? '');
  if (!valid)
    throw new ApiError(
      'INVALID_CREDENTIALS',
      'Invalid email or password.',
      401
    );

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: '7d',
  });

  return { user: excludePassword(user), token };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, settings: true },
  });
  if (!user) throw new ApiError('NOT_FOUND', 'User not found.', 404);
  return excludePassword(user);
};

export const updateMe = async (userId: string, data: any) => {
  const { fullName, profile, settings } = data;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(fullName && { fullName }),
      ...(profile && { profile: { update: profile } }),
      ...(settings && { settings: { update: settings } }),
    },
    include: { profile: true, settings: true },
  });

  return excludePassword(user);
};
