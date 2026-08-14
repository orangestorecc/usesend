// Catálogo de planos do app.
//
// A lista de verdade vive em `@usesend/lib/src/pricing` junto com a matriz de
// preços, porque o site (/pricing), a modal de upgrade e a tela de admin
// precisam dizer exatamente a mesma coisa. Aqui ficam só os apelidos que o app
// já usava, para não reescrever import por import.

import {
  CATALOGO_MARKETING,
  CATALOGO_TRANSACIONAL,
  PASSOS_MARKETING,
  PASSOS_TRANSACIONAL,
  type FeaturePlano,
  type PlanoDoCatalogo,
} from "@usesend/lib/src/pricing";

export type PlanFeature = FeaturePlano;
export type CatalogPlan = PlanoDoCatalogo;

export const TRANSACTIONAL_TIERS = PASSOS_TRANSACIONAL;
export const MARKETING_TIERS = PASSOS_MARKETING;

export const TRANSACTIONAL_PLANS = CATALOGO_TRANSACIONAL;
export const MARKETING_PLANS = CATALOGO_MARKETING;

export function priceLabel(p: CatalogPlan): string {
  if (p.priceBRL === null) return "Personalizado";
  return `R$ ${p.priceBRL.toLocaleString("pt-BR")}`;
}
