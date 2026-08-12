-- CreateTable
CREATE TABLE "ContactImport" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "contactBookId" TEXT NOT NULL,
    "userId" INTEGER,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mapping" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ContactImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactImport_contactBookId_startedAt_idx" ON "ContactImport"("contactBookId", "startedAt");

-- CreateIndex
CREATE INDEX "ContactImport_teamId_idx" ON "ContactImport"("teamId");

