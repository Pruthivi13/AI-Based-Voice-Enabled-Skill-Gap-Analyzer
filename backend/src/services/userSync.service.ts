import prisma from '../config/prisma';

export const syncUser = async (
  email: string,
  supabaseUid: string,
  fullName?: string,
  emailVerified = false
) => {
  const user = await prisma.user.upsert({
    where: { supabaseUid },
    update: { email, fullName, emailVerified },
    create: {
      email,
      supabaseUid,
      fullName,
      emailVerified,
      profile: { create: {} },
      settings: { create: {} },
    },
    include: { profile: true, settings: true },
  });
  return user;
};
