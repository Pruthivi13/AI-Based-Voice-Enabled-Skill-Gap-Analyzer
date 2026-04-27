-- CreateEnum
CREATE TYPE "DifficultyRating" AS ENUM ('TOO_EASY', 'JUST_RIGHT', 'TOO_HARD');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "adjustedDifficulty" TEXT,
ADD COLUMN     "justRightCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tooEasyCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tooHardCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuestionFeedback" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "difficultyRating" "DifficultyRating" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionFeedback_questionId_idx" ON "QuestionFeedback"("questionId");

-- CreateIndex
CREATE INDEX "QuestionFeedback_userId_idx" ON "QuestionFeedback"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionFeedback_userId_questionId_sessionId_key" ON "QuestionFeedback"("userId", "questionId", "sessionId");

-- AddForeignKey
ALTER TABLE "QuestionFeedback" ADD CONSTRAINT "QuestionFeedback_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFeedback" ADD CONSTRAINT "QuestionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
