import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.question.count();
  console.log(`Questions in DB: ${count}`);
}
main().finally(() => prisma.$disconnect());
