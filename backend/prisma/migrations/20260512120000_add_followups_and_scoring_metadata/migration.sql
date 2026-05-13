-- Add scoring provenance to response analyses.
ALTER TABLE "ResponseAnalysis" ADD COLUMN "llmProvider" TEXT;
ALTER TABLE "ResponseAnalysis" ADD COLUMN "scorerBackend" TEXT;

-- Persist generated follow-up questions per response.
CREATE TABLE "FollowupQuestion" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "reason" TEXT,
    "topic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowupQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FollowupQuestion_responseId_idx" ON "FollowupQuestion"("responseId");

ALTER TABLE "FollowupQuestion" ADD CONSTRAINT "FollowupQuestion_responseId_fkey"
FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
