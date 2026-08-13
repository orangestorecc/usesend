-- CreateEnum
CREATE TYPE "ForwardingRuleStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'PAUSED', 'DISABLED_BOUNCED');

-- CreateEnum
CREATE TYPE "ForwardStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "ForwardingRule" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "domainId" INTEGER,
    "destination" TEXT NOT NULL,
    "status" "ForwardingRuleStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationToken" TEXT,
    "verificationSentAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "forwardedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastForwardedAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForwardingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundForward" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "inboundEmailId" TEXT NOT NULL,
    "status" "ForwardStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "sesMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundForward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForwardingRule_verificationToken_key" ON "ForwardingRule"("verificationToken");

-- CreateIndex
CREATE INDEX "ForwardingRule_teamId_status_idx" ON "ForwardingRule"("teamId", "status");

-- CreateIndex
CREATE INDEX "ForwardingRule_domainId_status_idx" ON "ForwardingRule"("domainId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ForwardingRule_teamId_domainId_destination_key" ON "ForwardingRule"("teamId", "domainId", "destination");

-- CreateIndex
CREATE INDEX "InboundForward_teamId_createdAt_idx" ON "InboundForward"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundForward_ruleId_inboundEmailId_key" ON "InboundForward"("ruleId", "inboundEmailId");

-- AddForeignKey
ALTER TABLE "ForwardingRule" ADD CONSTRAINT "ForwardingRule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForwardingRule" ADD CONSTRAINT "ForwardingRule_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundForward" ADD CONSTRAINT "InboundForward_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ForwardingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundForward" ADD CONSTRAINT "InboundForward_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
