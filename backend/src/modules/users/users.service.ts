import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

const excludePassword = (user: any) => {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
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
