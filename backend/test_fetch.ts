import prisma from './src/config/prisma';
import { getCourseRecommendations } from './src/modules/courses/courses.service';

async function test() {
  const userId = 'cmnkgzz9c0000jfkku6ry9590'; // Wait, I need a valid userId
  const session = await prisma.interviewSession.findUnique({
    where: { id: 'cmnlj47ld0001jfkknawulfwb' }
  });
  console.log('Session user ID:', session?.userId);
  try {
    const res = await getCourseRecommendations(session!.userId, 'cmnlj47ld0001jfkknawulfwb', true);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}
test().finally(() => prisma.$disconnect());
