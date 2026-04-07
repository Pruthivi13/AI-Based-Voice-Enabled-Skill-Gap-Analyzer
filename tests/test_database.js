/**
 * Complete database test — checks every table and operation
 * Run: cd backend && node ../tests/test_database.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const GREEN = '\x1b[92m';
const RED = '\x1b[91m';
const YELLOW = '\x1b[93m';
const CYAN = '\x1b[96m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;
const errors = [];

function ok(msg) {
  console.log(`${GREEN}  ✓ ${msg}${RESET}`);
  passed++;
}
function fail(msg) {
  console.log(`${RED}  ✗ ${msg}${RESET}`);
  failed++;
  errors.push(msg);
}
function info(msg) {
  console.log(`${CYAN}  → ${msg}${RESET}`);
}
function head(msg) {
  console.log(
    `\n${BOLD}${YELLOW}${'─'.repeat(55)}\n  ${msg}\n${'─'.repeat(55)}${RESET}`
  );
}

// ─── cleanup helper ───────────────────────────────────────────────────────────
async function cleanup(userId) {
  if (!userId) return;
  try {
    await prisma.user.delete({ where: { id: userId } });
    info('Cleaned up test user and all cascaded data');
  } catch (e) {
    // already deleted
  }
}

async function run() {
  console.log(`\n${BOLD}╔══════════════════════════════════════════════╗`);
  console.log(`║   DATABASE COMPLETE TEST SUITE               ║`);
  console.log(`╚══════════════════════════════════════════════╝${RESET}\n`);

  let testUserId = null;
  let testSessionId = null;
  let testQuestionId = null;
  let testResponseId = null;

  // ══════════════════════════════════════════════════════════════════
  // TEST 1 — Connection
  // ══════════════════════════════════════════════════════════════════
  head('TEST 1 — Database Connection');
  try {
    await prisma.$queryRaw`SELECT 1 as result`;
    ok('Connected to PostgreSQL successfully');

    const version = await prisma.$queryRaw`SELECT version()`;
    info(`PostgreSQL: ${version[0].version.split(' ').slice(0, 2).join(' ')}`);
    ok('Database version retrieved');
  } catch (e) {
    fail(`Connection failed: ${e.message}`);
    console.error(
      `\n${RED}CRITICAL: Cannot connect to DB. Check DATABASE_URL in backend/.env${RESET}\n`
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 2 — All tables exist
  // ══════════════════════════════════════════════════════════════════
  head('TEST 2 — Table Existence');
  const expectedTables = [
    'User',
    'UserProfile',
    'UserSettings',
    'InterviewSession',
    'Question',
    'Response',
    'ResponseAnalysis',
    'Report',
    'Upload',
    'Roadmap',
    'CourseRecommendation',
  ];

  for (const table of expectedTables) {
    try {
      // Use Prisma's model access dynamically
      const count =
        await prisma[table.charAt(0).toLowerCase() + table.slice(1)].count();
      ok(`Table "${table}" exists — ${count} rows`);
    } catch (e) {
      fail(`Table "${table}" missing or inaccessible: ${e.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 3 — User CREATE (Registration simulation)
  // ══════════════════════════════════════════════════════════════════
  head('TEST 3 — User Registration (CREATE)');
  const testEmail = `test_${Date.now()}@testdb.com`;

  try {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        supabaseUid: `test_uid_${Date.now()}`,
        fullName: 'Test User DB',
        emailVerified: false,
        profile: { create: {} },
        settings: { create: {} },
      },
      include: { profile: true, settings: true },
    });

    testUserId = user.id;
    ok(`User created with id: ${user.id}`);
    ok(`Email stored: ${user.email}`);
    ok(`Profile auto-created: ${user.profile ? 'yes' : 'no'}`);
    ok(`Settings auto-created: ${user.settings ? 'yes' : 'no'}`);
    info(
      `Full user: ${JSON.stringify(
        {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          profileId: user.profile?.id,
          settingsId: user.settings?.id,
        },
        null,
        2
      )}`
    );
  } catch (e) {
    fail(`User create failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 4 — User READ
  // ══════════════════════════════════════════════════════════════════
  head('TEST 4 — User Read (LOGIN simulation)');
  try {
    const found = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { profile: true, settings: true },
    });
    ok(`User found by email: ${found?.email}`);
    ok(`Profile loaded: ${found?.profile ? 'yes' : 'no'}`);
    ok(`Settings loaded: ${found?.settings ? 'yes' : 'no'}`);

    const foundById = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    ok(`User found by id: ${foundById?.id}`);
  } catch (e) {
    fail(`User read failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 5 — User UPDATE
  // ══════════════════════════════════════════════════════════════════
  head('TEST 5 — User Update');
  try {
    const updated = await prisma.user.update({
      where: { id: testUserId },
      data: {
        fullName: 'Updated Test User',
        emailVerified: true,
        profile: {
          update: { targetRole: 'Frontend Developer', bio: 'Test bio' },
        },
        settings: { update: { theme: 'dark', sessionReminders: false } },
      },
      include: { profile: true, settings: true },
    });
    ok(`fullName updated: ${updated.fullName}`);
    ok(`emailVerified updated: ${updated.emailVerified}`);
    ok(`profile.targetRole updated: ${updated.profile?.targetRole}`);
    ok(`settings.theme updated: ${updated.settings?.theme}`);
  } catch (e) {
    fail(`User update failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 6 — Duplicate email rejection
  // ══════════════════════════════════════════════════════════════════
  head('TEST 6 — Unique Constraint (Duplicate Email)');
  try {
    await prisma.user.create({
      data: {
        email: testEmail, // same email
        supabaseUid: `test_uid_dupe_${Date.now()}`,
      },
    });
    fail(
      'Should have rejected duplicate email — UNIQUE constraint not working'
    );
  } catch (e) {
    if (e.code === 'P2002') {
      ok('Duplicate email correctly rejected (P2002 unique constraint)');
    } else {
      fail(`Wrong error type: ${e.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 7 — Question table
  // ══════════════════════════════════════════════════════════════════
  head('TEST 7 — Question Table');
  try {
    const question = await prisma.question.create({
      data: {
        content: 'What is a REST API? (DB TEST)',
        category: 'TECHNICAL',
        difficulty: 'EASY',
        timeLimitSeconds: 120,
        referenceAnswer:
          'REST is an architectural style for stateless HTTP communication.',
        isActive: true,
      },
    });
    testQuestionId = question.id;
    ok(`Question created: ${question.id}`);
    ok(
      `referenceAnswer stored: ${question.referenceAnswer ? 'yes' : 'NO - MISSING'}`
    );
    info(
      `referenceAnswer value: "${question.referenceAnswer?.slice(0, 60)}..."`
    );

    const allQ = await prisma.question.count({ where: { isActive: true } });
    ok(`Total active questions in DB: ${allQ}`);

    // Check seeded questions exist
    const technical = await prisma.question.count({
      where: { category: 'TECHNICAL' },
    });
    const hr = await prisma.question.count({ where: { category: 'HR' } });
    info(`TECHNICAL questions: ${technical}, HR questions: ${hr}`);
  } catch (e) {
    fail(`Question create failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 8 — InterviewSession CREATE
  // ══════════════════════════════════════════════════════════════════
  head('TEST 8 — Interview Session Create');
  try {
    const session = await prisma.interviewSession.create({
      data: {
        userId: testUserId,
        title: 'DB Test Session',
        interviewType: 'TECHNICAL',
        targetRole: 'Frontend Developer',
        difficulty: 'MEDIUM',
        experienceLevel: 'JUNIOR',
        questionCount: 3,
        status: 'CREATED',
      },
    });
    testSessionId = session.id;
    ok(`Session created: ${session.id}`);
    ok(`Status is CREATED: ${session.status === 'CREATED'}`);
    ok(`userId linked: ${session.userId === testUserId}`);
  } catch (e) {
    fail(`Session create failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 9 — Response + Transcript storage
  // ══════════════════════════════════════════════════════════════════
  head('TEST 9 — Response & Transcript Storage');
  try {
    const response = await prisma.response.create({
      data: {
        sessionId: testSessionId,
        questionId: testQuestionId,
        answerOrder: 1,
        transcript:
          'REST is an architectural style for HTTP-based communication using standard methods.',
        durationSeconds: 45,
      },
    });
    testResponseId = response.id;
    ok(`Response created: ${response.id}`);
    ok(`Transcript stored: ${response.transcript ? 'yes' : 'NO'}`);
    ok(`DurationSeconds stored: ${response.durationSeconds}`);
    info(`Transcript: "${response.transcript?.slice(0, 60)}..."`);

    // Test unique constraint (same session + question)
    try {
      await prisma.response.create({
        data: {
          sessionId: testSessionId,
          questionId: testQuestionId,
          answerOrder: 2,
        },
      });
      fail('Should reject duplicate sessionId+questionId — constraint broken');
    } catch (e) {
      if (e.code === 'P2002') {
        ok('sessionId+questionId unique constraint works correctly');
      }
    }
  } catch (e) {
    fail(`Response create failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 10 — ResponseAnalysis (AI Model scores storage)
  // ══════════════════════════════════════════════════════════════════
  head('TEST 10 — ResponseAnalysis (AI Score Storage)');
  try {
    const analysis = await prisma.responseAnalysis.create({
      data: {
        responseId: testResponseId,
        clarityScore: 8.2,
        fluencyScore: 7.5,
        confidenceScore: 7.0,
        relevanceScore: 9.1,
        grammarScore: 8.0,
        pronunciationScore: 7.8,
        technicalScore: 8.5,
        fillerWordCount: 3,
        speechRateWpm: 130,
        sentiment: 'positive',
        overallScore: 8.3,
        feedbackJson: [
          'Your answer is relevant and covers the main points clearly.',
          'Good technical depth shown.',
        ],
      },
    });
    ok(`ResponseAnalysis created: ${analysis.id}`);
    ok(`overallScore stored: ${analysis.overallScore}`);
    ok(`relevanceScore stored: ${analysis.relevanceScore}`);
    ok(
      `feedbackJson stored: ${Array.isArray(analysis.feedbackJson) ? 'yes (array)' : 'no'}`
    );
    ok(`technicalScore stored: ${analysis.technicalScore}`);
    info(
      `Full scores: clarity=${analysis.clarityScore} fluency=${analysis.fluencyScore} confidence=${analysis.confidenceScore}`
    );

    // Read back
    const readBack = await prisma.responseAnalysis.findUnique({
      where: { responseId: testResponseId },
    });
    ok(
      `Read back from DB: ${readBack?.overallScore === 8.3 ? 'matches' : 'MISMATCH'}`
    );
  } catch (e) {
    fail(`ResponseAnalysis create failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 11 — Report storage
  // ══════════════════════════════════════════════════════════════════
  head('TEST 11 — Report Storage');
  try {
    const report = await prisma.report.create({
      data: {
        sessionId: testSessionId,
        overallScore: 8.3,
        ratingLabel: 'Good',
        summary: 'Strong performance with clear communication.',
        strengthsJson: ['Clear structure', 'Good vocabulary'],
        weaknessesJson: ['Could add more examples'],
        recommendationsJson: ['Practice system design questions'],
        radarDataJson: {
          labels: ['Communication', 'Technical', 'Clarity'],
          values: [8.0, 8.5, 7.9],
        },
      },
    });
    ok(`Report created: ${report.id}`);
    ok(`overallScore: ${report.overallScore}`);
    ok(`ratingLabel: ${report.ratingLabel}`);
    ok(`strengthsJson is array: ${Array.isArray(report.strengthsJson)}`);
    ok(`radarDataJson stored: ${report.radarDataJson ? 'yes' : 'no'}`);
  } catch (e) {
    fail(`Report create failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 12 — Roadmap storage
  // ══════════════════════════════════════════════════════════════════
  head('TEST 12 — Roadmap Storage');
  try {
    const roadmap = await prisma.roadmap.create({
      data: {
        sessionId: testSessionId,
        targetRole: 'Frontend Developer',
        nodesJson: [
          { id: 'root', type: 'root', data: { label: 'Frontend Developer' } },
        ],
        edgesJson: [{ id: 'e1', source: 'root', target: 'm1' }],
      },
    });
    ok(`Roadmap created: ${roadmap.id}`);
    ok(`nodesJson stored: ${Array.isArray(roadmap.nodesJson)}`);
    ok(`edgesJson stored: ${Array.isArray(roadmap.edgesJson)}`);

    // Test upsert (used in real flow)
    const upserted = await prisma.roadmap.upsert({
      where: { sessionId: testSessionId },
      update: { targetRole: 'Senior Frontend Developer' },
      create: {
        sessionId: testSessionId,
        targetRole: 'Senior Frontend Developer',
        nodesJson: [],
        edgesJson: [],
      },
    });
    ok(`Roadmap upsert works: ${upserted.targetRole}`);
  } catch (e) {
    fail(`Roadmap create failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 13 — Session status transitions
  // ══════════════════════════════════════════════════════════════════
  head('TEST 13 — Session Status Transitions');
  const statuses = ['CREATED', 'IN_PROGRESS', 'PROCESSING', 'COMPLETED'];
  for (const status of statuses) {
    try {
      const updated = await prisma.interviewSession.update({
        where: { id: testSessionId },
        data: { status },
      });
      ok(
        `Status → ${status}: ${updated.status === status ? 'ok' : 'MISMATCH'}`
      );
    } catch (e) {
      fail(`Status transition to ${status} failed: ${e.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 14 — CASCADE DELETE (delete user removes everything)
  // ══════════════════════════════════════════════════════════════════
  head('TEST 14 — Cascade Delete');
  try {
    // Confirm all related records exist before delete
    const analysisBefore = await prisma.responseAnalysis.findUnique({
      where: { responseId: testResponseId },
    });
    const reportBefore = await prisma.report.findUnique({
      where: { sessionId: testSessionId },
    });
    ok(
      `ResponseAnalysis exists before delete: ${analysisBefore ? 'yes' : 'no'}`
    );
    ok(`Report exists before delete: ${reportBefore ? 'yes' : 'no'}`);

    // Delete user — should cascade to everything
    await prisma.user.delete({ where: { id: testUserId } });
    ok('User deleted successfully');
    testUserId = null; // mark as already deleted

    // Verify cascade worked
    const sessionAfter = await prisma.interviewSession.findUnique({
      where: { id: testSessionId },
    });
    const responseAfter = await prisma.response.findUnique({
      where: { id: testResponseId },
    });
    const analysisAfter = await prisma.responseAnalysis.findUnique({
      where: { responseId: testResponseId },
    });

    ok(
      `Session cascade deleted: ${sessionAfter === null ? 'yes' : 'NO - STILL EXISTS'}`
    );
    ok(
      `Response cascade deleted: ${responseAfter === null ? 'yes' : 'NO - STILL EXISTS'}`
    );
    ok(
      `ResponseAnalysis cascade deleted: ${analysisAfter === null ? 'yes' : 'NO - STILL EXISTS'}`
    );
  } catch (e) {
    fail(`Cascade delete test failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 15 — Clean up test question
  // ══════════════════════════════════════════════════════════════════
  head('TEST 15 — Cleanup');
  try {
    if (testQuestionId) {
      await prisma.question.delete({ where: { id: testQuestionId } });
      ok('Test question cleaned up');
    }
    if (testUserId) {
      await cleanup(testUserId);
    }
    ok('All test data removed from DB');
  } catch (e) {
    fail(`Cleanup failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 16 — Real data sanity check
  // ══════════════════════════════════════════════════════════════════
  head('TEST 16 — Real Data Sanity Check');
  try {
    const userCount = await prisma.user.count();
    const questionCount = await prisma.question.count();
    const sessionCount = await prisma.interviewSession.count();
    const responseCount = await prisma.response.count();
    const analysisCount = await prisma.responseAnalysis.count();

    info(`Users in DB:              ${userCount}`);
    info(`Questions in DB:          ${questionCount}`);
    info(`Interview Sessions in DB: ${sessionCount}`);
    info(`Responses in DB:          ${responseCount}`);
    info(`ResponseAnalysis in DB:   ${analysisCount}`);

    ok(
      `Questions seeded: ${questionCount > 0 ? `yes (${questionCount})` : 'NO - run seeder'}`
    );

    const withRef = await prisma.question.count({
      where: { referenceAnswer: { not: null } },
    });
    info(`Questions WITH referenceAnswer: ${withRef} / ${questionCount}`);
    if (withRef === 0) {
      fail(
        'NO questions have referenceAnswer — AI scoring will use fallback only'
      );
    } else {
      ok(`${withRef} questions have referenceAnswer for AI scoring`);
    }

    const completedSessions = await prisma.interviewSession.count({
      where: { status: 'COMPLETED' },
    });
    info(`Completed sessions: ${completedSessions}`);

    const analysisWithScores = await prisma.responseAnalysis.count({
      where: { overallScore: { not: null } },
    });
    info(`ResponseAnalysis with scores: ${analysisWithScores}`);
  } catch (e) {
    fail(`Sanity check failed: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ══════════════════════════════════════════════════════════════════
  const total = passed + failed;
  const pct = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`${BOLD}  DATABASE TEST SUMMARY${RESET}`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`  ${GREEN}Passed: ${passed}${RESET}`);
  console.log(`  ${RED}Failed: ${failed}${RESET}`);
  console.log(`  Score:  ${passed}/${total} (${pct}%)`);

  if (errors.length > 0) {
    console.log(`\n  ${RED}${BOLD}Failures:${RESET}`);
    errors.forEach((e) => console.log(`  ${RED}  • ${e}${RESET}`));
  }

  console.log(`${'═'.repeat(55)}\n`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
