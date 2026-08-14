import {
  ADDONS,
  EXTRAS,
  cotaMensalDoPlano,
  precoExcedenteBRL,
} from "@usesend/lib/src/pricing";

import { db } from "~/server/db";
import { getThisMonthUsage } from "~/server/service/usage-service";

/**
 * Extras do ciclo: pay-as-you-go e add-ons.
 *
 * Regra de ouro daqui: o valor nunca é lido de lugar nenhum, é sempre
 * recalculado a partir do uso do ciclo e da tabela de preços — e só então
 * congelado na fatura. Guardar um saldo acumulado seria convidar a
 * dupla-cobrança na primeira vez que um job rodasse duas vezes.
 *
 * O preço do bloco excedente sai do próprio plano (`precoExcedenteBRL`), que é
 * a mesma linha "E-mails extras: R$ X / 1.000" anunciada no /pricing. Cobrar um
 * valor fixo enquanto a vitrine anuncia outro seria cobrar diferente do
 * combinado.
 */

export type ExtrasDoCiclo = {
  /** Total em centavos a somar na próxima fatura. */
  totalCents: number;
  /** Frase pronta para a fatura se explicar depois, quando o uso já rodou. */
  detalhe: string | null;
  /** Quanto passou da cota, para a tela de Uso mostrar em tempo real. */
  emailsExcedentes: number;
  cotaMensal: number | null;
};

const centavos = (reais: number) => Math.round(reais * 100);

export type PlanoDoCiclo = {
  planKey: string;
  tier: number;
  overageEmailsEnabled: boolean;
  dedicatedIpActiveAt: Date | null;
};

/**
 * Quanto de excedente o time acumulou no mês corrente.
 *
 * Blocos são arredondados para cima: 1 e-mail além da cota já é um bloco de
 * 1.000. É como o texto na tela promete ("cobrança automática por bloco
 * adicional de 1.000 e-mails") e é o que evita cobrar fração de centavo.
 */
export async function calcularExtrasDoCiclo(
  teamId: number,
  plano: PlanoDoCiclo,
): Promise<ExtrasDoCiclo> {
  const cota = cotaMensalDoPlano(plano.planKey, plano.tier);
  const linhas: string[] = [];
  let totalCents = 0;
  let excedentes = 0;

  if (plano.overageEmailsEnabled && cota !== null) {
    const usage = await getThisMonthUsage(teamId);
    const enviados = usage.month.reduce((acc, curr) => acc + curr.sent, 0);
    excedentes = Math.max(0, enviados - cota);

    if (excedentes > 0) {
      const precoBloco =
        precoExcedenteBRL(plano.planKey, plano.tier) ??
        EXTRAS.transacional.precoPorMilBRL;
      const blocos = Math.ceil(excedentes / 1000);
      const valor = centavos(precoBloco) * blocos;
      totalCents += valor;
      linhas.push(
        `${excedentes.toLocaleString("pt-BR")} e-mails além da cota de ` +
          `${cota.toLocaleString("pt-BR")} · ${blocos} bloco(s) de 1.000 × ` +
          `R$ ${precoBloco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      );
    }
  }

  // O add-on só entra na fatura depois de provisionado e aquecido: cobrar a
  // partir do pedido seria cobrar por um IP que ainda não entrega nada.
  if (plano.dedicatedIpActiveAt) {
    totalCents += centavos(ADDONS.ipDedicado.precoMensalBRL);
    linhas.push(
      `IP dedicado · R$ ${ADDONS.ipDedicado.precoMensalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / mês`,
    );
  }

  return {
    totalCents,
    detalhe: linhas.length ? linhas.join(" · ") : null,
    emailsExcedentes: excedentes,
    cotaMensal: cota,
  };
}

/** Atalho para quem só tem o teamId em mãos (job de renovação, tela de Uso). */
export async function extrasDoTime(teamId: number): Promise<ExtrasDoCiclo> {
  const [team, sub] = await Promise.all([
    db.team.findUnique({
      where: { id: teamId },
      select: {
        planKey: true,
        overageEmailsEnabled: true,
        dedicatedIpActiveAt: true,
      },
    }),
    db.subscription.findFirst({
      where: { teamId, status: { in: ["active", "past_due"] } },
      orderBy: { createdAt: "desc" },
      select: { tier: true },
    }),
  ]);

  if (!team) {
    return {
      totalCents: 0,
      detalhe: null,
      emailsExcedentes: 0,
      cotaMensal: null,
    };
  }

  return calcularExtrasDoCiclo(teamId, {
    planKey: team.planKey,
    tier: sub?.tier ?? 0,
    overageEmailsEnabled: team.overageEmailsEnabled,
    dedicatedIpActiveAt: team.dedicatedIpActiveAt,
  });
}
