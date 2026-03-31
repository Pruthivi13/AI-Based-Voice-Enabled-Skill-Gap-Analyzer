const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const session = await prisma.interviewSession.findFirst();
  const q = await prisma.question.findFirst({ where: { category: 'TECHNICAL' } });

  console.log("Using session", session.id, "question", q.id);

  const res = await fetch(`http://localhost:3001/api/sessions/${session.id}/questions/${q.id}/transcript`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: "This is a test transcript", answerOrder: 1 })
  });

  const body = await res.text();
  console.log("Status:", res.status, "Body:", body);
}
test().catch(console.error).finally(()=>prisma.$disconnect());
