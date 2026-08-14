-- Extras (pay-as-you-go) e add-on de IP dedicado.
--
-- Os quatro campos do time guardam a INTENCAO do cliente; o valor cobrado nao
-- mora aqui. Ele e recalculado no fechamento do ciclo a partir do uso do mes e
-- da tabela de precos, e so entao congelado na fatura (overageCents /
-- overageDetail) -- pelo mesmo motivo que a memoria de calculo do plano ja e
-- congelada: preco muda com o tempo, a fatura de marco nao.

ALTER TABLE "Team"
  ADD COLUMN "overageEmailsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "overageAutomationsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dedicatedIpRequestedAt" TIMESTAMP(3),
  ADD COLUMN "dedicatedIpActiveAt" TIMESTAMP(3);

ALTER TABLE "Invoice"
  ADD COLUMN "overageCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overageDetail" TEXT;

ALTER TABLE "Charge"
  ADD COLUMN "overageCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overageDetail" TEXT;

-- Passo do slider contratado. Sem ele a renovacao recorrente resolvia o preco
-- so pela chave do plano e cobrava o degrau base: um Pro marketing de 100.000
-- contatos (R$ 2.250) renovava por R$ 200. As assinaturas ja existentes ficam
-- em 0, que e exatamente o comportamento que elas tinham antes.
ALTER TABLE "Subscription" ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Charge"       ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice"      ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 0;
