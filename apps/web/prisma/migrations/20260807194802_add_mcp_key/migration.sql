-- CreateTable
CREATE TABLE "McpKey" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "partialToken" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpKey_clientId_key" ON "McpKey"("clientId");

-- CreateIndex
CREATE INDEX "McpKey_teamId_idx" ON "McpKey"("teamId");

-- AddForeignKey
ALTER TABLE "McpKey" ADD CONSTRAINT "McpKey_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
