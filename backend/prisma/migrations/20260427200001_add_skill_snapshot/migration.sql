-- CreateTable
CREATE TABLE "SkillSnapshot" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "sessionId"        TEXT NOT NULL,
    "date"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clarityScore"     DOUBLE PRECISION,
    "fluencyScore"     DOUBLE PRECISION,
    "confidenceScore"  DOUBLE PRECISION,
    "relevanceScore"   DOUBLE PRECISION,
    "technicalScore"   DOUBLE PRECISION,
    "grammarScore"     DOUBLE PRECISION,
    "overallScore"     DOUBLE PRECISION,

    CONSTRAINT "SkillSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillSnapshot_userId_idx" ON "SkillSnapshot"("userId");
CREATE INDEX "SkillSnapshot_date_idx"   ON "SkillSnapshot"("date");

-- Unique: one snapshot per session
CREATE UNIQUE INDEX "SkillSnapshot_sessionId_key" ON "SkillSnapshot"("sessionId");

-- AddForeignKey
ALTER TABLE "SkillSnapshot"
    ADD CONSTRAINT "SkillSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SkillSnapshot"
    ADD CONSTRAINT "SkillSnapshot_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
