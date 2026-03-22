-- DropIndex
DROP INDEX "User_firebaseUid_idx";

-- DropIndex
DROP INDEX "User_firebaseUid_key";

-- Rename column instead of drop and recreate
ALTER TABLE "User" RENAME COLUMN "firebaseUid" TO "supabaseUid";

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUid_key" ON "User"("supabaseUid");

-- CreateIndex
CREATE INDEX "User_supabaseUid_idx" ON "User"("supabaseUid");