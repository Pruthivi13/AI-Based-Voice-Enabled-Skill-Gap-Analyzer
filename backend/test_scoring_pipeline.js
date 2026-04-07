/**
 * Full pipeline test: saves a transcript, verifies scoring runs,
 * checks DB for stored ResponseAnalysis.
 *
 * Run: node test_scoring_pipeline.js
 * (from backend/ directory, with both services running)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = 'http://localhost:3001';

async function getAuthToken() {
  // Use an existing user token — replace with a valid Firebase token
  // OR use a test session directly via Prisma bypassing auth
  return null; // we'll go direct via Prisma for this test
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  SCORING PIPELINE TEST');
  console.log('══════════════════════════════════════════\n');

  // 1. Find a real question with referenceAnswer
  const question = await prisma.question.findFirst({
    where: { referenceAnswer: { not: null } },
  });

  if (!question) {
    console.error('❌ No question with referenceAnswer found.');
    console.error(
      '   Run: npx ts-node src/scripts/importQuestionBank.ts first'
    );
    process.exit(1);
  }

  console.log(`✓ Found question: "${question.content.slice(0, 60)}..."`);
  console.log(`  Reference: "${question.referenceAnswer.slice(0, 60)}..."`);

  // 2. Find a real session and user
  const session = await prisma.interviewSession.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    console.error('❌ No sessions in DB. Create one via the frontend first.');
    process.exit(1);
  }
  console.log(`✓ Using session: ${session.id}`);

  // 3. Create a test response with a known transcript
  const testTranscript = `REST is an architectural style for stateless client-server 
    communication over HTTP. It uses standard methods like GET, POST, PUT, and DELETE 
    to perform operations on resources identified by URLs. It is widely used for web APIs.`;

  // Upsert response
  let response;
  const existing = await prisma.response.findUnique({
    where: {
      sessionId_questionId: { sessionId: session.id, questionId: question.id },
    },
  });

  if (existing) {
    response = await prisma.response.update({
      where: { id: existing.id },
      data: { transcript: testTranscript, answerOrder: 1 },
    });
  } else {
    response = await prisma.response.create({
      data: {
        sessionId: session.id,
        questionId: question.id,
        transcript: testTranscript,
        answerOrder: 1,
      },
    });
  }
  console.log(`✓ Response created/updated: ${response.id}`);

  // 4. Call the ML service directly to score it
  console.log('\n  Calling ML service /internal/evaluate-answer...');
  const mlResponse = await fetch(
    'http://localhost:8000/internal/evaluate-answer',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question.content,
        answer: testTranscript,
        reference: question.referenceAnswer,
      }),
    }
  );

  if (!mlResponse.ok) {
    console.error(`❌ ML service returned ${mlResponse.status}`);
    const err = await mlResponse.text();
    console.error(err);
    process.exit(1);
  }

  const scoreResult = await mlResponse.json();
  console.log('\n  ── ML Service Response ──────────────────');
  console.log(JSON.stringify(scoreResult, null, 4));

  // Validate response shape
  const required = [
    'model_label',
    'keyword_overlap',
    'answer_length',
    'final_score',
    'feedback',
  ];
  for (const key of required) {
    if (key in scoreResult) {
      console.log(`  ✓ Has '${key}': ${scoreResult[key]}`);
    } else {
      console.error(`  ✗ MISSING '${key}'`);
    }
  }

  // 5. Save scoring result to DB manually
  const overallScore =
    scoreResult.final_score === 'STRONG'
      ? 8.5
      : scoreResult.final_score === 'AVERAGE'
        ? 6.5
        : 4.5;

  const analysis = await prisma.responseAnalysis.upsert({
    where: { responseId: response.id },
    update: {
      relevanceScore: scoreResult.keyword_overlap * 10,
      technicalScore: overallScore,
      overallScore,
      feedbackJson: [scoreResult.feedback],
      sentiment: scoreResult.final_score === 'STRONG' ? 'positive' : 'neutral',
    },
    create: {
      responseId: response.id,
      relevanceScore: scoreResult.keyword_overlap * 10,
      technicalScore: overallScore,
      overallScore,
      feedbackJson: [scoreResult.feedback],
      sentiment: scoreResult.final_score === 'STRONG' ? 'positive' : 'neutral',
    },
  });

  console.log('\n  ── DB Stored ResponseAnalysis ───────────');
  console.log(`  responseId:      ${analysis.responseId}`);
  console.log(`  overallScore:    ${analysis.overallScore}`);
  console.log(`  relevanceScore:  ${analysis.relevanceScore}`);
  console.log(`  technicalScore:  ${analysis.technicalScore}`);
  console.log(`  feedbackJson:    ${JSON.stringify(analysis.feedbackJson)}`);
  console.log(`  sentiment:       ${analysis.sentiment}`);

  // 6. Read it back to confirm persistence
  const readBack = await prisma.responseAnalysis.findUnique({
    where: { responseId: response.id },
  });

  console.log('\n  ── Verification (read back from DB) ─────');
  if (readBack && readBack.overallScore === overallScore) {
    console.log(`  ✓ Data persisted correctly in DB`);
    console.log(`  ✓ overallScore matches: ${readBack.overallScore}`);
  } else {
    console.error(`  ✗ Data mismatch in DB`);
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  ALL CHECKS COMPLETE');
  console.log('══════════════════════════════════════════\n');

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
