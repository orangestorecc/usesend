-- Admin da plataforma deixa de ser um único e-mail no .env e passa a ser um
-- atributo da conta. O ADMIN_EMAIL continua valendo como salvaguarda no
-- código, então a instalação nunca fica sem nenhum admin.
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
