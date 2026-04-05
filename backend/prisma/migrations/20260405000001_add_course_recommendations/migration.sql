-- CreateTable
CREATE TABLE "CourseRecommendation" (
    "id"         TEXT NOT NULL,
    "sessionId"  TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "coursesJson" JSONB NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseRecommendation_sessionId_key" ON "CourseRecommendation"("sessionId");

-- AddForeignKey
ALTER TABLE "CourseRecommendation"
    ADD CONSTRAINT "CourseRecommendation_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "InterviewSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
