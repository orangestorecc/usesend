-- Link de acesso deixa de ser magic link do NextAuth (VerificationToken) e
-- ganha model próprio, porque o resgate precisa prender a sessão ao time que
-- emitiu o link. Sessão global permitia que um admin do time A entrasse como
-- um alvo que também é admin do time B e trocasse de workspace.
--
-- `Session.accessLinkTeamId` é NULL para toda sessão existente: nenhuma delas
-- nasceu de link de acesso, então nada muda para quem já está logado.
-- ADD COLUMN sem DEFAULT no PostgreSQL 11+ não reescreve a tabela.

ALTER TABLE "Session" ADD COLUMN "accessLinkTeamId" INTEGER;

CREATE INDEX "Session_accessLinkTeamId_idx" ON "Session"("accessLinkTeamId");

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_accessLinkTeamId_fkey"
  FOREIGN KEY ("accessLinkTeamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccessLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "targetUserId" INTEGER NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessLink_tokenHash_key" ON "AccessLink"("tokenHash");
CREATE INDEX "AccessLink_teamId_targetUserId_idx" ON "AccessLink"("teamId", "targetUserId");
CREATE INDEX "AccessLink_expiresAt_idx" ON "AccessLink"("expiresAt");

ALTER TABLE "AccessLink"
  ADD CONSTRAINT "AccessLink_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessLink"
  ADD CONSTRAINT "AccessLink_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessLink"
  ADD CONSTRAINT "AccessLink_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Links pendentes emitidos no formato antigo (magic link do NextAuth) morrem
-- agora: a rota de callback do e-mail continua existindo para login normal,
-- mas nenhum link de acesso deve sobreviver à troca de mecanismo.
DELETE FROM "VerificationToken" WHERE "expires" > NOW() AND "expires" < NOW() + INTERVAL '31 minutes';
