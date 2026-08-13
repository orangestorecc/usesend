-- Meu Perfil: sessao elevada, MFA por e-mail, troca de e-mail e auditoria.
-- Tudo aditivo: nenhuma coluna existente muda de tipo ou vira obrigatoria.

-- Session: estado de MFA e de sessao elevada vive na row, porque o projeto
-- usa database sessions (PrismaAdapter sem `strategy`).
ALTER TABLE "Session" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "elevatedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "Session" ADD COLUMN "ip" TEXT;
ALTER TABLE "Session" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- User: correlacao pos-delete, MFA, e-mail pendente e pseudonimizacao.
ALTER TABLE "User" ADD COLUMN "subjectId" TEXT;
UPDATE "User" SET "subjectId" = gen_random_uuid()::text WHERE "subjectId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "subjectId" SET NOT NULL;
CREATE UNIQUE INDEX "User_subjectId_key" ON "User"("subjectId");

ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- Unique parcial: duas contas nao podem disputar o mesmo e-mail novo, mas
-- varias contas podem ter pendingEmail nulo.
CREATE UNIQUE INDEX "User_pendingEmail_key" ON "User"("pendingEmail")
  WHERE "pendingEmail" IS NOT NULL;

-- Codigos de seguranca (HMAC + pepper, TTL, tentativas, consumo atomico).
CREATE TABLE "SecurityCode" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHmac" TEXT NOT NULL,
    "pepperVersion" INTEGER NOT NULL DEFAULT 1,
    "sentTo" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityCode_userId_purpose_idx" ON "SecurityCode"("userId", "purpose");
CREATE INDEX "SecurityCode_expiresAt_idx" ON "SecurityCode"("expiresAt");
ALTER TABLE "SecurityCode" ADD CONSTRAINT "SecurityCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Desafio de MFA amarrado ao sessionToken: cada dispositivo tem o seu.
CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "codeHmac" TEXT NOT NULL,
    "pepperVersion" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MfaChallenge_sessionToken_key" ON "MfaChallenge"("sessionToken");
CREATE INDEX "MfaChallenge_expiresAt_idx" ON "MfaChallenge"("expiresAt");
ALTER TABLE "MfaChallenge" ADD CONSTRAINT "MfaChallenge_sessionToken_fkey"
  FOREIGN KEY ("sessionToken") REFERENCES "Session"("sessionToken") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHmac" TEXT NOT NULL,
    "pepperVersion" INTEGER NOT NULL DEFAULT 1,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MfaRecoveryCode_userId_idx" ON "MfaRecoveryCode"("userId");
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reset de MFA pelo suporte: two-person rule + 72h com cancelamento pelo dono.
CREATE TABLE "MfaResetRequest" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "cancelToken" TEXT NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "executesAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaResetRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MfaResetRequest_cancelToken_key" ON "MfaResetRequest"("cancelToken");
CREATE INDEX "MfaResetRequest_userId_idx" ON "MfaResetRequest"("userId");

-- Troca de e-mail com double opt-in e janela de reversao de 7 dias.
CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "oldEmail" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "currentConfirmedAt" TIMESTAMP(3),
    "newConfirmedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "revertToken" TEXT NOT NULL,
    "revertDeadline" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "oauthAccountsSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailChangeRequest_revertToken_key" ON "EmailChangeRequest"("revertToken");
CREATE INDEX "EmailChangeRequest_userId_idx" ON "EmailChangeRequest"("userId");
CREATE INDEX "EmailChangeRequest_revertDeadline_idx" ON "EmailChangeRequest"("revertDeadline");
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Auditoria. Sem FK para o usuario: o log tem que sobreviver ao hard delete
-- da conta; a correlacao continua pelo targetSubject.
CREATE TABLE "UserAuditLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorEmail" TEXT,
    "targetUserId" INTEGER,
    "targetSubject" TEXT,
    "targetEmail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserAuditLog_targetUserId_createdAt_idx" ON "UserAuditLog"("targetUserId", "createdAt");
CREATE INDEX "UserAuditLog_targetSubject_idx" ON "UserAuditLog"("targetSubject");
CREATE INDEX "UserAuditLog_event_createdAt_idx" ON "UserAuditLog"("event", "createdAt");
CREATE INDEX "UserAuditLog_createdAt_idx" ON "UserAuditLog"("createdAt");

-- "Membro desde" no perfil. Vinculos antigos herdam a data desta migration:
-- nao ha registro de quando entraram, e inventar data seria pior que assumir.
ALTER TABLE "TeamUser" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
