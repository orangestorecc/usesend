-- Oferta de template no editor vazio: gravada quando o lojista dispensa,
-- para a oferta nao voltar naquela campanha.
ALTER TABLE "Campaign" ADD COLUMN "templateOfferDismissedAt" TIMESTAMP(3);
