-- CreateTable
CREATE TABLE "PlatformSyncRun" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformSyncRun_integrationId_startedAt_idx" ON "PlatformSyncRun"("integrationId", "startedAt");

-- CreateIndex
CREATE INDEX "PlatformSyncRun_teamId_idx" ON "PlatformSyncRun"("teamId");

