-- Add streak tracking fields to UserProfile
ALTER TABLE "UserProfile"
  ADD COLUMN IF NOT EXISTS "currentStreak"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "longestStreak"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastPracticeDate" TIMESTAMP(3);

-- Add reminder preferences to UserSettings
ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "preferredReminderTime"  TEXT,
  ADD COLUMN IF NOT EXISTS "preferredPracticeTime"  TEXT;

-- Add SCHEDULED and CANCELLED to SessionStatus enum
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Add scheduledAt to InterviewSession
ALTER TABLE "InterviewSession"
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

-- Index for scheduled sessions
CREATE INDEX IF NOT EXISTS "InterviewSession_scheduledAt_idx" ON "InterviewSession"("scheduledAt");
