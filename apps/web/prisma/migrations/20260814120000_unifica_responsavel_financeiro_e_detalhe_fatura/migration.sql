-- Unifica o cadastro fiscal em BillingContact e liga Invoice a Charge, para
-- que o responsavel financeiro digitado no checkout apareca em Configuracoes
-- e para que a fatura consiga mostrar boleto/PIX/cartao.

-- 1) BillingContact ganha os campos que so existiam em BillingProfile.
ALTER TABLE "BillingContact"
  ADD COLUMN IF NOT EXISTS "billingEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "personType" TEXT NOT NULL DEFAULT 'PJ',
  ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'BR';

-- billingEmails passa a conter, no minimo, o e-mail principal ja cadastrado.
UPDATE "BillingContact"
SET "billingEmails" = ARRAY["email"]
WHERE cardinality("billingEmails") = 0 AND "email" <> '';

-- personType deixa de ser inferido pela contagem de digitos do documento.
UPDATE "BillingContact"
SET "personType" = CASE
  WHEN length(regexp_replace(coalesce("documento", ''), '\D', '', 'g')) = 11 THEN 'PF'
  ELSE 'PJ'
END;

-- 2) Backfill: times que so tinham BillingProfile passam a ter BillingContact.
-- BillingContact vence nos times que ja tem os dois (era o comportamento do
-- merge em dadosFiscaisDoPagador), entao aqui so inserimos o que falta.
INSERT INTO "BillingContact" (
  "id", "teamId", "responsavel", "email", "billingEmails", "personType",
  "country", "documento", "razaoSocial", "nomeFantasia", "cep", "logradouro",
  "complemento", "bairro", "cidade", "uf", "whatsapp", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."teamId",
  coalesce(p."name", ''),
  coalesce(p."billingEmails"[1], ''),
  coalesce(p."billingEmails", ARRAY[]::TEXT[]),
  coalesce(p."personType", 'PJ'),
  coalesce(p."country", 'BR'),
  p."document",
  p."name",
  p."tradeName",
  p."postalCode",
  p."addressLine1",
  p."addressLine2",
  p."district",
  p."city",
  p."state",
  coalesce(p."whatsapp", ''),
  p."createdAt",
  p."updatedAt"
FROM "BillingProfile" p
WHERE NOT EXISTS (
  SELECT 1 FROM "BillingContact" c WHERE c."teamId" = p."teamId"
);

-- Complementa os BillingContact existentes com os campos que so o
-- BillingProfile tinha preenchido. Nunca sobrescreve valor ja existente.
UPDATE "BillingContact" c
SET
  "documento"    = coalesce(c."documento", p."document"),
  "razaoSocial"  = coalesce(c."razaoSocial", p."name"),
  "nomeFantasia" = coalesce(c."nomeFantasia", p."tradeName"),
  "cep"          = coalesce(c."cep", p."postalCode"),
  "logradouro"   = coalesce(c."logradouro", p."addressLine1"),
  "complemento"  = coalesce(c."complemento", p."addressLine2"),
  "bairro"       = coalesce(c."bairro", p."district"),
  "cidade"       = coalesce(c."cidade", p."city"),
  "uf"           = coalesce(c."uf", p."state"),
  "country"      = coalesce(p."country", c."country"),
  "billingEmails" = CASE
    WHEN cardinality(c."billingEmails") = 0
      THEN coalesce(p."billingEmails", ARRAY[]::TEXT[])
    ELSE c."billingEmails"
  END,
  "updatedAt"    = now()
FROM "BillingProfile" p
WHERE p."teamId" = c."teamId";

-- 3) Fatura: campos de nota fiscal.
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "nfStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "nfNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "nfUrl" TEXT;

-- 4) Charge: bandeira/final do cartao para a tela de detalhe.
ALTER TABLE "Charge"
  ADD COLUMN IF NOT EXISTS "cardBrand" TEXT,
  ADD COLUMN IF NOT EXISTS "cardLast4" TEXT;

-- 5) Invoice <-> Charge vira relation de verdade. Antes de criar a FK,
-- limpa invoiceId orfao (era string solta, sem garantia de integridade).
UPDATE "Charge"
SET "invoiceId" = NULL
WHERE "invoiceId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i."id" = "Charge"."invoiceId");

CREATE INDEX IF NOT EXISTS "Charge_invoiceId_idx" ON "Charge"("invoiceId");

ALTER TABLE "Charge"
  ADD CONSTRAINT "Charge_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
