-- O aceite de convite passa a buscar pelo e-mail da sessao (e nao pelo id
-- recebido do navegador), entao a busca por e-mail vira caminho quente.
CREATE INDEX "TeamInvite_email_idx" ON "TeamInvite"("email");
