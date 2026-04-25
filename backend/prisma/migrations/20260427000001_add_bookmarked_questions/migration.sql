-- CreateTable
CREATE TABLE "BookmarkedQuestion" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookmarkedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookmarkedQuestion_userId_questionId_key"
    ON "BookmarkedQuestion"("userId", "questionId");

CREATE INDEX "BookmarkedQuestion_userId_idx"    ON "BookmarkedQuestion"("userId");
CREATE INDEX "BookmarkedQuestion_questionId_idx" ON "BookmarkedQuestion"("questionId");

-- AddForeignKey
ALTER TABLE "BookmarkedQuestion"
    ADD CONSTRAINT "BookmarkedQuestion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookmarkedQuestion"
    ADD CONSTRAINT "BookmarkedQuestion_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
