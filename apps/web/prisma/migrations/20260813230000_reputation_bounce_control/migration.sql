-- Controle de bounce: engine de reputacao (alerta, bloqueio e recuperacao).
-- Ver docs-spec/BOUNCE-CONTROL-SPEC.md

-- CreateEnum
CREATE TYPE "ReputationState" AS ENUM ('HEALTHY', 'WARNING', 'CRITICAL', 'BLOCKED', 'SUPERVISED', 'EXEMPT');

-- AlterTable: bloqueio por reputacao separado de "isBlocked" (bloqueio comercial,
-- que o payment-service limpa ao confirmar pagamento).
ALTER TABLE "Team" ADD COLUMN     "sendingBlockedAt" TIMESTAMP(3),
ADD COLUMN     "sendingBlockedReason" TEXT;

-- AlterTable: distingue campanha pausada pela engine de campanha pausada pelo cliente
ALTER TABLE "Campaign" ADD COLUMN     "pausedByReputationAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReputationPolicy" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER,
    "windowDays" INTEGER NOT NULL DEFAULT 30,
    "shortWindowSize" INTEGER NOT NULL DEFAULT 1000,
    "minVolume" INTEGER NOT NULL DEFAULT 500,
    "minBounces" INTEGER NOT NULL DEFAULT 10,
    "warningRate" DECIMAL(6,3) NOT NULL DEFAULT 0.4,
    "criticalRate" DECIMAL(6,3) NOT NULL DEFAULT 1.0,
    "blockRate" DECIMAL(6,3) NOT NULL DEFAULT 2.0,
    "unblockRate" DECIMAL(6,3) NOT NULL DEFAULT 1.2,
    "minRecoveryVolume" INTEGER NOT NULL DEFAULT 200,
    "autoBlock" BOOLEAN NOT NULL DEFAULT false,
    "supervisedLimit" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReputationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamReputationState" (
    "teamId" INTEGER NOT NULL,
    "state" "ReputationState" NOT NULL DEFAULT 'HEALTHY',
    "bounceRate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "complaintRate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "sampleAtBlock" INTEGER,
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "supervisedUntil" TIMESTAMP(3),
    "supervisedLimit" INTEGER,
    "exemptUntil" TIMESTAMP(3),
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamReputationState_pkey" PRIMARY KEY ("teamId")
);

-- CreateTable
CREATE TABLE "ReputationEvent" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "fromState" "ReputationState" NOT NULL,
    "toState" "ReputationState" NOT NULL,
    "bounceRate" DECIMAL(6,3) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReputationPolicy_teamId_key" ON "ReputationPolicy"("teamId");

-- CreateIndex
CREATE INDEX "TeamReputationState_state_idx" ON "TeamReputationState"("state");

-- CreateIndex
CREATE INDEX "ReputationEvent_teamId_createdAt_idx" ON "ReputationEvent"("teamId", "createdAt" DESC);

-- CreateIndex: janela curta (ultimos N eventos com veredito do time)
CREATE INDEX "EmailEvent_teamId_status_createdAt_idx" ON "EmailEvent"("teamId", "status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ReputationPolicy" ADD CONSTRAINT "ReputationPolicy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamReputationState" ADD CONSTRAINT "TeamReputationState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Politica global inicial. autoBlock = false: a engine nasce em shadow mode,
-- medindo e alertando sem bloquear ninguem (fase 1 do rollout).
INSERT INTO "ReputationPolicy" ("teamId", "updatedAt") VALUES (NULL, CURRENT_TIMESTAMP);
