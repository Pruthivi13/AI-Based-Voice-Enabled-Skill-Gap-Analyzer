require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log('Prisma success!');
    await prisma.$disconnect();
  } catch (e) {
    console.log('Prisma error:', e.message);
  }
}
main();
