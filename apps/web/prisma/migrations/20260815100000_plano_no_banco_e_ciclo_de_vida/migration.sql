-- Plano de verdade no banco (catálogo de preços manda) + campos de ciclo de
-- vida: trava por inadimplência, cancelamento e exclusão por inatividade.

ALTER TABLE "Team" ADD COLUMN "planKey" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Team" ADD COLUMN "planProduct" TEXT NOT NULL DEFAULT 'transactional';
ALTER TABLE "Team" ADD COLUMN "billingBlockedAt" TIMESTAMP(3);
ALTER TABLE "Team" ADD COLUMN "inactivityWarnedAt" TIMESTAMP(3);
ALTER TABLE "Team" ADD COLUMN "inactivityDeleteAt" TIMESTAMP(3);

ALTER TABLE "Subscription" ADD COLUMN "canceledAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "endedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "cancelReason" TEXT;

-- Backfill: o plano vem do priceId da assinatura vigente ("produto:plano").
UPDATE "Team" t
SET "planProduct" = split_part(s."priceId", ':', 1),
    "planKey"     = split_part(s."priceId", ':', 2)
FROM (
  SELECT DISTINCT ON ("teamId") "teamId", "priceId"
  FROM "Subscription"
  WHERE "status" IN ('active', 'past_due')
  ORDER BY "teamId", "createdAt" DESC
) s
WHERE s."teamId" = t."id"
  AND split_part(s."priceId", ':', 2) <> '';

-- Time pago sem assinatura legível cai no plano pago de entrada, não no free:
-- rebaixar quem já paga seria pior do que superestimar um plano.
UPDATE "Team"
SET "planKey" = 'pro'
WHERE "plan" = 'BASIC' AND "planKey" = 'free';

CREATE INDEX "Team_planKey_idx" ON "Team"("planKey");
CREATE INDEX "Team_billingBlockedAt_idx" ON "Team"("billingBlockedAt");
CREATE INDEX "Subscription_canceledAt_idx" ON "Subscription"("canceledAt");
