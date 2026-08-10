-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "domainId" INTEGER,
    "s3Key" TEXT NOT NULL,
    "messageId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "to" TEXT[],
    "subject" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountOffCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxRedemptions" INTEGER,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCatalogEntry" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceBRL" INTEGER,
    "volume" TEXT NOT NULL,
    "extra" TEXT,
    "features" JSONB NOT NULL,
    "cta" TEXT NOT NULL DEFAULT 'Fazer upgrade',
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cardToken" TEXT,
    "brand" TEXT,
    "last4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "holderName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "method" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerChargeId" TEXT,
    "pixQrCode" TEXT,
    "pixQrImage" TEXT,
    "boletoUrl" TEXT,
    "boletoBarcode" TEXT,
    "planKey" TEXT,
    "product" TEXT,
    "promoCode" TEXT,
    "failReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewayLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "operation" TEXT,
    "requestHeaders" JSONB,
    "requestBody" JSONB,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "chargeId" TEXT,
    "teamId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentGatewayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewayConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "configEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnsubscribePageSettings" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "logoUrl" TEXT,
    "bgColor" TEXT NOT NULL DEFAULT '#05050A',
    "textColor" TEXT NOT NULL DEFAULT '#EDEEF0',
    "accentColor" TEXT NOT NULL DEFAULT '#363A3F',
    "hideBranding" BOOLEAN NOT NULL DEFAULT false,
    "prefsTitle" TEXT NOT NULL DEFAULT 'Deseja cancelar a inscrição?',
    "prefsSubtitle" TEXT NOT NULL DEFAULT 'Confirme suas preferências de e-mail:',
    "unsubButtonLabel" TEXT NOT NULL DEFAULT 'Cancelar inscrição',
    "successTitle" TEXT NOT NULL DEFAULT 'Suas preferências de e-mail foram atualizadas.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnsubscribePageSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingProfile" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "billingEmails" TEXT[],
    "whatsapp" TEXT,
    "personType" TEXT NOT NULL DEFAULT 'PJ',
    "document" TEXT,
    "name" TEXT,
    "tradeName" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "postalCode" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'open',
    "description" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "apiKeyId" INTEGER,
    "apiKeyName" TEXT,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'http',
    "userAgent" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAuthCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scope" TEXT,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_s3Key_key" ON "InboundEmail"("s3Key");

-- CreateIndex
CREATE INDEX "InboundEmail_teamId_createdAt_idx" ON "InboundEmail"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCatalogEntry_product_key_key" ON "PlanCatalogEntry"("product", "key");

-- CreateIndex
CREATE INDEX "PaymentMethod_teamId_idx" ON "PaymentMethod"("teamId");

-- CreateIndex
CREATE INDEX "Charge_teamId_createdAt_idx" ON "Charge"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "Charge_providerChargeId_idx" ON "Charge"("providerChargeId");

-- CreateIndex
CREATE INDEX "PaymentGatewayLog_provider_createdAt_idx" ON "PaymentGatewayLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentGatewayLog_chargeId_idx" ON "PaymentGatewayLog"("chargeId");

-- CreateIndex
CREATE INDEX "PaymentGatewayLog_createdAt_idx" ON "PaymentGatewayLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayConfig_provider_key" ON "PaymentGatewayConfig"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "UnsubscribePageSettings_teamId_key" ON "UnsubscribePageSettings"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingProfile_teamId_key" ON "BillingProfile"("teamId");

-- CreateIndex
CREATE INDEX "Invoice_teamId_createdAt_idx" ON "Invoice"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_teamId_createdAt_idx" ON "ApiRequestLog"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthCode_code_key" ON "OAuthAuthCode"("code");

-- CreateIndex
CREATE INDEX "OAuthAuthCode_clientId_idx" ON "OAuthAuthCode"("clientId");

