-- Prazo do convite deixa de ser derivado do `createdAt`.
-- Sem coluna própria, "Reenviar convite" não tinha o que renovar.

-- 1) Coluna nullable para não travar a tabela existente.
ALTER TABLE "TeamInvite" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- 2) Backfill preservando exatamente a regra antiga (createdAt + 7 dias).
--    Convites já vencidos continuam vencidos; os válidos mantêm o prazo que o
--    convidado já tinha visto no e-mail.
UPDATE "TeamInvite" SET "expiresAt" = "createdAt" + INTERVAL '7 days' WHERE "expiresAt" IS NULL;

-- 3) Só depois do backfill a coluna vira obrigatória.
ALTER TABLE "TeamInvite" ALTER COLUMN "expiresAt" SET NOT NULL;

-- Consulta quente: "convites válidos deste e-mail".
CREATE INDEX "TeamInvite_expiresAt_idx" ON "TeamInvite"("expiresAt");
