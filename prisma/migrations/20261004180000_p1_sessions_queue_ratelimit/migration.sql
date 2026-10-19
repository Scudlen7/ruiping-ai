-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "analysisAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "analysisModelKey" TEXT,
ADD COLUMN     "analysisQueuedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "analysisAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "analysisModelKey" TEXT,
ADD COLUMN     "analysisQueuedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "parents" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" SERIAL NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" INTEGER NOT NULL,
    "feature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "modelKey" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "submissionKind" TEXT,
    "submissionId" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_buckets_resetAt_idx" ON "rate_limit_buckets"("resetAt");

-- CreateIndex
CREATE INDEX "ai_usage_actorType_actorId_createdAt_idx" ON "ai_usage"("actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_submissionKind_submissionId_idx" ON "ai_usage"("submissionKind", "submissionId");

-- CreateIndex
CREATE INDEX "assignments_analysisStatus_analysisQueuedAt_idx" ON "assignments"("analysisStatus", "analysisQueuedAt");

-- CreateIndex
CREATE INDEX "exams_analysisStatus_analysisQueuedAt_idx" ON "exams"("analysisStatus", "analysisQueuedAt");
