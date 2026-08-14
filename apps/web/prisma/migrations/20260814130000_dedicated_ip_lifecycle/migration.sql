-- Ciclo de vida do add-on de IP dedicado.
-- Antes so existiam `requestedAt` e `activeAt`, e a transicao entre os dois era
-- um UPDATE manual no banco. Estes campos dao ao admin o estado intermediario
-- (aquecimento) e permitem cancelar sem apagar o historico do mes faturado.
ALTER TABLE "Team" ADD COLUMN "dedicatedIpWarmupStartedAt" TIMESTAMP(3);
ALTER TABLE "Team" ADD COLUMN "dedicatedIpCanceledAt" TIMESTAMP(3);
ALTER TABLE "Team" ADD COLUMN "dedicatedIpAddress" TEXT;
