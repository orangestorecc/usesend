-- AlterTable
ALTER TABLE "ContactBook" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Listas geradas pelo "Rodar teste" de integração antes desta coluna existir.
UPDATE "ContactBook" SET "isTest" = true WHERE "name" LIKE '[Teste] Integração —%';
