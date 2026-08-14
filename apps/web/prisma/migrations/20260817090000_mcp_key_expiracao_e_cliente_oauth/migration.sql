-- Chaves MCP emitidas pelo fluxo OAuth passam a ter prazo de validade, e a
-- gente passa a saber qual cliente OAuth obteve cada uma (para revogar por
-- aplicativo, e não só chave a chave).
--
-- Ambas nulas para as linhas existentes de propósito: chave criada à mão no
-- painel continua sem prazo, que é o caso de servidor e CI.

ALTER TABLE "McpKey" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "McpKey" ADD COLUMN "oauthClientId" TEXT;
