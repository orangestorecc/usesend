import { db } from "~/server/db";
import { logger } from "~/server/logger/log";
import {
  FREE_PLAN_KEY,
  aplicarPlano,
  parsePriceId,
} from "~/server/billing/plan-service";
import {
  enviarAvisoDeTrava,
  enviarAvisoDeInatividade,
} from "~/server/billing/lifecycle-mailer";
import { TeamService } from "~/server/service/team-service";

/**
 * Ciclo de vida comercial da conta: inadimplência, downgrade e sono.
 *
 * Três regras vivem aqui porque compartilham a mesma pergunta — "esta conta
 * ainda vale o recurso que ocupa?" — e porque todas mexem no mesmo par de
 * campos (plano do time e estado da assinatura). Espalhá-las por jobs
 * diferentes era o caminho curto para duas delas discordarem.
 */

/** Carência entre o vencimento e a trava. Pedido do produto: 24 horas. */
export const HORAS_ATE_TRAVAR = 24;
/** Conta gratuita parada por este tempo entra na fila de exclusão. */
export const MESES_DE_INATIVIDADE = 6;
/** Aviso sai com esta antecedência da exclusão. */
export const DIAS_DE_AVISO = 30;

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

/** Momento a partir do qual um vencimento já passou da carência. */
function limiteDeCarencia(now: Date) {
  return new Date(now.getTime() - HORAS_ATE_TRAVAR * HORA_MS);
}

/**
 * Trava os pagantes em atraso há mais de 24h.
 *
 * Trava = envio pausado, painel liberado. Um cliente sem acesso ao painel não
 * consegue pagar a fatura que o destravaria — e o objetivo aqui é receber, não
 * punir.
 */
export async function travarInadimplentes(now = new Date()) {
  const corte = limiteDeCarencia(now);

  const candidatos = await db.team.findMany({
    where: {
      planKey: { not: FREE_PLAN_KEY },
      billingBlockedAt: null,
      OR: [
        // Fatura em aberto vencida há mais de 24h.
        { id: { in: await teamsComFaturaVencida(corte) } },
        // Ou o período pago acabou e a renovação não entrou.
        {
          subscription: {
            some: {
              status: { in: ["active", "past_due"] },
              currentPeriodEnd: { lt: corte },
            },
          },
        },
      ],
    },
    select: { id: true, name: true },
  });

  let travados = 0;
  for (const team of candidatos) {
    await db.team.update({
      where: { id: team.id },
      data: { billingBlockedAt: now },
    });
    // A assinatura acompanha: quem está travado não conta como MRR ativo.
    await db.subscription.updateMany({
      where: { teamId: team.id, status: "active" },
      data: { status: "past_due" },
    });
    // Sem isto a trava só valeria depois do TTL do cache — e o envio seguiria
    // liberado enquanto isso.
    await TeamService.refreshTeamCache(team.id);
    await enviarAvisoDeTrava(team.id);
    travados += 1;
  }

  if (travados) {
    logger.info({ travados }, "[Lifecycle] Times travados por inadimplência");
  }
  return travados;
}

async function teamsComFaturaVencida(corte: Date) {
  const rows = await db.invoice.findMany({
    where: { status: "open", dueAt: { lt: corte } },
    select: { teamId: true },
    distinct: ["teamId"],
  });
  return rows.map((r) => r.teamId);
}

/** Solta a trava quando não há mais nada vencido. Chamado ao confirmar pagamento. */
export async function destravarSePago(teamId: number, now = new Date()) {
  const vencidas = await db.invoice.count({
    where: { teamId, status: "open", dueAt: { lt: now } },
  });
  if (vencidas > 0) return false;

  await db.team.update({
    where: { id: teamId },
    data: { billingBlockedAt: null },
  });
  await TeamService.refreshTeamCache(teamId);
  return true;
}

export type MotivoDeCancelamento =
  | "downgrade"
  | "inadimplencia"
  | "admin"
  | "conta_excluida";

/**
 * Downgrade para o plano gratuito.
 *
 * O efeito é imediato — não guardamos o acesso pago até o fim do período. Quem
 * pede downgrade quer parar de pagar agora, e manter o plano pago rodando com
 * a assinatura cancelada é o tipo de estado meio-termo que ninguém consegue
 * explicar depois no suporte.
 */
export async function downgradeParaGratis(
  teamId: number,
  motivo: MotivoDeCancelamento,
  now = new Date(),
) {
  const assinaturas = await db.subscription.findMany({
    where: { teamId, status: { in: ["active", "past_due"] } },
    select: { id: true, priceId: true },
  });

  await db.subscription.updateMany({
    where: { id: { in: assinaturas.map((s) => s.id) } },
    data: {
      status: "canceled",
      canceledAt: now,
      endedAt: now,
      cancelReason: motivo,
    },
  });

  await aplicarPlano(
    teamId,
    { product: "transactional", key: FREE_PLAN_KEY },
    { billingBlockedAt: null },
  );

  await TeamService.refreshTeamCache(teamId);

  logger.info(
    { teamId, motivo, planoAnterior: parsePriceId(assinaturas[0]?.priceId).key },
    "[Lifecycle] Downgrade para o plano gratuito",
  );

  return { canceladas: assinaturas.length };
}

/**
 * Última atividade do time.
 *
 * Deriva de dois sinais: dia com envio (DailyEmailUsage, que já vem agregado)
 * e sessão de login mais recente. Um campo `lastActivityAt` gravado a cada
 * e-mail custaria uma escrita por envio para responder a uma pergunta que só
 * roda uma vez por dia.
 */
export async function ultimaAtividade(
  teamIds: number[],
): Promise<Map<number, Date>> {
  const mapa = new Map<number, Date>();
  if (teamIds.length === 0) return mapa;

  const [envios, sessoes, times] = await Promise.all([
    db.dailyEmailUsage.groupBy({
      by: ["teamId"],
      where: { teamId: { in: teamIds }, sent: { gt: 0 } },
      _max: { date: true },
    }),
    db.session.findMany({
      where: { user: { teamUsers: { some: { teamId: { in: teamIds } } } } },
      select: { expires: true, user: { select: { teamUsers: true } } },
      orderBy: { expires: "desc" },
      take: 5000,
    }),
    db.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, createdAt: true },
    }),
  ]);

  const registrar = (teamId: number, data: Date) => {
    const atual = mapa.get(teamId);
    if (!atual || data.getTime() > atual.getTime()) mapa.set(teamId, data);
  };

  for (const t of times) registrar(t.id, t.createdAt);
  for (const e of envios) {
    if (e._max.date) registrar(e.teamId, new Date(`${e._max.date}T00:00:00Z`));
  }
  for (const s of sessoes) {
    for (const vinculo of s.user.teamUsers) {
      if (teamIds.includes(vinculo.teamId)) registrar(vinculo.teamId, s.expires);
    }
  }

  return mapa;
}

/**
 * Contas gratuitas paradas há 6 meses: avisa hoje, exclui 30 dias depois.
 *
 * Nunca exclui sem aviso enviado — mesmo que a conta já esteja parada há dois
 * anos quando esta regra entrar no ar. A janela de 30 dias começa no aviso,
 * não na inatividade.
 */
export async function processarContasInativas(now = new Date()) {
  const corte = new Date(now);
  corte.setMonth(corte.getMonth() - MESES_DE_INATIVIDADE);

  const gratuitos = await db.team.findMany({
    where: { planKey: FREE_PLAN_KEY },
    select: {
      id: true,
      name: true,
      inactivityWarnedAt: true,
      inactivityDeleteAt: true,
    },
  });

  const atividade = await ultimaAtividade(gratuitos.map((t) => t.id));
  let avisados = 0;
  let excluidos = 0;
  let recuperados = 0;

  for (const team of gratuitos) {
    const ultima = atividade.get(team.id) ?? now;
    const inativo = ultima.getTime() < corte.getTime();

    if (!inativo) {
      // Voltou a usar dentro da janela: o aviso perde a validade.
      if (team.inactivityWarnedAt || team.inactivityDeleteAt) {
        await db.team.update({
          where: { id: team.id },
          data: { inactivityWarnedAt: null, inactivityDeleteAt: null },
        });
        recuperados += 1;
      }
      continue;
    }

    if (!team.inactivityWarnedAt) {
      const excluirEm = new Date(now.getTime() + DIAS_DE_AVISO * DIA_MS);
      await db.team.update({
        where: { id: team.id },
        data: { inactivityWarnedAt: now, inactivityDeleteAt: excluirEm },
      });
      await enviarAvisoDeInatividade(team.id, excluirEm);
      avisados += 1;
      continue;
    }

    if (team.inactivityDeleteAt && team.inactivityDeleteAt.getTime() <= now.getTime()) {
      await db.team.delete({ where: { id: team.id } });
      logger.warn(
        { teamId: team.id, nome: team.name },
        "[Lifecycle] Conta gratuita excluída por inatividade",
      );
      excluidos += 1;
    }
  }

  if (avisados || excluidos || recuperados) {
    logger.info(
      { avisados, excluidos, recuperados },
      "[Lifecycle] Varredura de contas gratuitas inativas",
    );
  }
  return { avisados, excluidos, recuperados };
}
