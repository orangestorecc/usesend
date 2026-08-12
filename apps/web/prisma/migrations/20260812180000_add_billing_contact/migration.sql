-- CreateTable
CREATE TABLE "BillingContact" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "responsavel" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "documento" TEXT,
    "razaoSocial" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingContact_teamId_key" ON "BillingContact"("teamId");

-- AddForeignKey
ALTER TABLE "BillingContact" ADD CONSTRAINT "BillingContact_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

