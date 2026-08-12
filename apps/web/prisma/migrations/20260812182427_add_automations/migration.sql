-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerEventName" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "connections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentStepKey" TEXT,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "context" JSONB NOT NULL DEFAULT '{}',
    "resumeAt" TIMESTAMP(3),
    "waitingForEvent" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationStepRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationStepRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomEvent" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_teamId_idx" ON "Automation"("teamId");

-- CreateIndex
CREATE INDEX "Automation_teamId_triggerEventName_status_idx" ON "Automation"("teamId", "triggerEventName", "status");

-- CreateIndex
CREATE INDEX "AutomationRun_teamId_automationId_idx" ON "AutomationRun"("teamId", "automationId");

-- CreateIndex
CREATE INDEX "AutomationRun_status_resumeAt_idx" ON "AutomationRun"("status", "resumeAt");

-- CreateIndex
CREATE INDEX "AutomationRun_status_waitingForEvent_idx" ON "AutomationRun"("status", "waitingForEvent");

-- CreateIndex
CREATE INDEX "AutomationStepRun_runId_idx" ON "AutomationStepRun"("runId");

-- CreateIndex
CREATE INDEX "CustomEvent_teamId_name_idx" ON "CustomEvent"("teamId", "name");

-- CreateIndex
CREATE INDEX "CustomEvent_contactId_idx" ON "CustomEvent"("contactId");

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationStepRun" ADD CONSTRAINT "AutomationStepRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomEvent" ADD CONSTRAINT "CustomEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomEvent" ADD CONSTRAINT "CustomEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
