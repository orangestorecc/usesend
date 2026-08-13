-- Inbound: campos para o payload do webhook email.received
ALTER TABLE "InboundEmail" ADD COLUMN "cc" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "InboundEmail" ADD COLUMN "bcc" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "InboundEmail" ADD COLUMN "replyTo" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "InboundEmail" ADD COLUMN "headers" JSONB;
ALTER TABLE "InboundEmail" ADD COLUMN "attachments" JSONB;
ALTER TABLE "InboundEmail" ADD COLUMN "spamVerdict" TEXT;

-- Encaminhamento de e-mail (forwarding): regra origem → destino
CREATE TYPE "ForwardingRuleStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'PAUSED', 'DISABLED_BOUNCED');
CREATE TYPE "ForwardStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

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

CREATE UNIQUE INDEX "ForwardingRule_verificationToken_key" ON "ForwardingRule"("verificationToken");
CREATE UNIQUE INDEX "ForwardingRule_teamId_domainId_destination_key" ON "ForwardingRule"("teamId", "domainId", "destination");
CREATE INDEX "ForwardingRule_teamId_status_idx" ON "ForwardingRule"("teamId", "status");
CREATE INDEX "ForwardingRule_domainId_status_idx" ON "ForwardingRule"("domainId", "status");

ALTER TABLE "ForwardingRule" ADD CONSTRAINT "ForwardingRule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForwardingRule" ADD CONSTRAINT "ForwardingRule_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

CREATE UNIQUE INDEX "InboundForward_ruleId_inboundEmailId_key" ON "InboundForward"("ruleId", "inboundEmailId");
CREATE INDEX "InboundForward_teamId_createdAt_idx" ON "InboundForward"("teamId", "createdAt");

ALTER TABLE "InboundForward" ADD CONSTRAINT "InboundForward_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ForwardingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundForward" ADD CONSTRAINT "InboundForward_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
