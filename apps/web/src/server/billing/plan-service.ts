import type { Plan } from "@prisma/client";

import { db } from "~/server/db";
import {
  MARKETING_PLANS,
  TRANSACTIONAL_PLANS,
  type CatalogPlan,
} from "~/lib/constants/plan-catalog";
import { TeamService } from "~/server/service/team-service";

/**
 * Plano do time: uma fonte só.
 *
 * O que vale é a tabela de preços (`PlanCatalogEntry`), e o time guarda a
 * chave dela (`planKey` + `planProduct`). O enum `Plan` continua no banco
 * porque os limites antigos leem dele, mas virou espelho derivado: quem quiser
 * mudar plano chama `aplicarPlano`, e nunca escreve `plan` na mão. Enquanto
 * havia dois lugares dizendo qual é o plano, os dois podiam discordar — e
 * discordavam, porque o cancelamento nunca devolvia o time para FREE.
 */

export const FREE_PLAN_KEY = "free";
export type PlanProduct = "transactional" | "marketing";

export type PlanoResolvido = {
  key: string;
  product: PlanProduct;
  name: string;
  /** null = plano personalizado (Enterprise), sem preço de tabela. */
  priceBRL: number | null;
  priceCents: number;
  isPaid: boolean;
};

function codeCatalog(product: PlanProduct): CatalogPlan[] {
  return product === "marketing" ? MARKETING_PLANS : TRANSACTIONAL_PLANS;
}

/**
 * Preço e nome do plano segundo a tabela de preços do banco. O catálogo do
 * código só entra se a linha ainda não foi semeada — se o admin editou o
 * preço na tela de Planos, é aquele preço que vale em todo lugar.
 */
export async function resolverPlano(
  product: PlanProduct,
  key: string,
): Promise<PlanoResolvido | null> {
  const row = await db.planCatalogEntry.findUnique({
    where: { product_key: { product, key } },
    select: { name: true, priceBRL: true },
  });

  const fallback = codeCatalog(product).find((p) => p.key === key);
  const base = row ?? fallback;
  if (!base) return null;

  return {
    key,
    product,
    name: base.name,
    priceBRL: base.priceBRL,
    priceCents: base.priceBRL === null ? 0 : base.priceBRL * 100,
    isPaid: key !== FREE_PLAN_KEY && (base.priceBRL === null || base.priceBRL > 0),
  };
}

/** Espelho do enum antigo. Único ponto do sistema que decide FREE x BASIC. */
export function planEnumFor(key: string): Plan {
  return key === FREE_PLAN_KEY ? "FREE" : "BASIC";
}

/**
 * Grava o plano do time (chave + espelho do enum) numa transação só.
 * `extra` permite carregar junto o que muda no mesmo movimento — por exemplo
 * limpar a trava de inadimplência quando o pagamento entra.
 */
export async function aplicarPlano(
  teamId: number,
  input: { product: PlanProduct; key: string },
  extra: { isActive?: boolean; isBlocked?: boolean; billingBlockedAt?: Date | null } = {},
) {
  const team = await db.team.update({
    where: { id: teamId },
    data: {
      planKey: input.key,
      planProduct: input.product,
      plan: planEnumFor(input.key),
      ...extra,
    },
  });
  // O cache do time alimenta os limites de envio: sem esta linha, um upgrade
  // ou uma trava só passariam a valer no vencimento do TTL.
  await TeamService.refreshTeamCache(teamId);
  return team;
}

/** Lê "produto:plano" do priceId da assinatura. */
export function parsePriceId(priceId: string | null | undefined) {
  const [product, key] = (priceId ?? ":").split(":");
  return {
    product: (product === "marketing" ? "marketing" : "transactional") as PlanProduct,
    key: key || null,
  };
}

export function priceIdFor(product: PlanProduct, key: string) {
  return `${product}:${key}`;
}
