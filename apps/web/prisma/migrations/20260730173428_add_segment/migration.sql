-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "contactBookId" TEXT,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Segment_teamId_idx" ON "Segment"("teamId");

-- CreateIndex
CREATE INDEX "Segment_contactBookId_idx" ON "Segment"("contactBookId");
