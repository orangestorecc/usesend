-- Novos dominios passam a nascer com rastreamento de cliques e aberturas ativo.
-- Dominios ja existentes nao sao alterados de proposito: ligar rastreamento
-- retroativamente mudaria o comportamento de envio sem o usuario pedir.
ALTER TABLE "Domain" ALTER COLUMN "clickTracking" SET DEFAULT true;
ALTER TABLE "Domain" ALTER COLUMN "openTracking" SET DEFAULT true;
