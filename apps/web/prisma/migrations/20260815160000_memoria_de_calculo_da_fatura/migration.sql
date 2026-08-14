-- Memoria de calculo na fatura e na cobranca.
-- subtotalCents - discountCents + surchargeCents = amountCents

ALTER TABLE "Invoice"
  ADD COLUMN "planName" TEXT,
  ADD COLUMN "planKey" TEXT,
  ADD COLUMN "product" TEXT,
  ADD COLUMN "subtotalCents" INTEGER,
  ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "promoCode" TEXT,
  ADD COLUMN "promoLabel" TEXT,
  ADD COLUMN "surchargeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "installments" INTEGER;

ALTER TABLE "Charge"
  ADD COLUMN "planName" TEXT,
  ADD COLUMN "promoLabel" TEXT,
  ADD COLUMN "subtotalCents" INTEGER,
  ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "surchargeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "installments" INTEGER;

-- Faturas antigas nao tem cupom nem juros: o subtotal e o proprio valor pago.
-- Sem isso a modal mostraria "subtotal desconhecido" para todo o historico.
UPDATE "Invoice" SET "subtotalCents" = "amountCents" WHERE "subtotalCents" IS NULL;
