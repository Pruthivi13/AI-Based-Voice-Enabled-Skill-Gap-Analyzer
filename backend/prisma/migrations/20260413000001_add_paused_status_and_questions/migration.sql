-- Add PAUSED to SessionStatus enum
ALTER TYPE "SessionStatus" ADD VALUE 'PAUSED';

-- Add pausedAt and questionsJson to InterviewSession
ALTER TABLE "InterviewSession"
  ADD COLUMN "pausedAt"      TIMESTAMP(3),
  ADD COLUMN "questionsJson" JSONB;
