-- Estado do wizard de onboarding (progresso em si e derivado, nao gravado)
ALTER TABLE "Team" ADD COLUMN "onboardingState" JSONB;

-- Rate limit do disparo em massa de pedidos de opt-in por lista
ALTER TABLE "ContactBook" ADD COLUMN "lastBulkOptInAt" TIMESTAMP(3);

-- Cooldown de 24h por contato para pedido de confirmacao
ALTER TABLE "Contact" ADD COLUMN "doubleOptInSentAt" TIMESTAMP(3);
