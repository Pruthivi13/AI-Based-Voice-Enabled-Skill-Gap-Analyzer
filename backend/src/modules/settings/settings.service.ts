import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

export const getSettings = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, settings: true },
  });
  if (!user) throw new ApiError('NOT_FOUND', 'User not found.', 404);

  return {
    name: user.fullName,
    email: user.email,
    preferredRole: user.profile?.targetRole,
    theme: user.settings?.theme,
    notifications: {
      sessionReminders: user.settings?.sessionReminders,
      weeklyProgress: user.settings?.weeklyProgress,
      newResources: user.settings?.newResources,
    },
  };
};

export const updateSettings = async (userId: string, data: any) => {
  const { name, preferredRole, theme, notifications } = data;

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { fullName: name }),
      ...(preferredRole && {
        profile: { update: { targetRole: preferredRole } },
      }),
      ...(theme && {
        settings: { update: { theme } },
      }),
      ...(notifications && {
        settings: {
          update: {
            ...(notifications.sessionReminders !== undefined && {
              sessionReminders: notifications.sessionReminders,
            }),
            ...(notifications.weeklyProgress !== undefined && {
              weeklyProgress: notifications.weeklyProgress,
            }),
            ...(notifications.newResources !== undefined && {
              newResources: notifications.newResources,
            }),
          },
        },
      }),
    },
  });

  return { success: true };
};
