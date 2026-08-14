import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { LimitService } from "~/server/service/limit-service";
import { LimitReason, PLAN_LIMITS } from "~/lib/constants/plans";
import {
  ADDONS,
  EXTRAS,
  PLANO_MINIMO_IP_DEDICADO,
  cotaMensalDoPlano,
  planoTemIpDedicado,
  precoExcedenteBRL,
} from "@usesend/lib/src/pricing";
import { notificarPedidoIpDedicado } from "~/server/service/dedicated-ip-service";
import { calcularExtrasDoCiclo } from "~/server/billing/overage-service";
import { FREE_PLAN_KEY } from "~/server/billing/plan-service";
import { db } from "~/server/db";
import { getThisMonthUsage } from "~/server/service/usage-service";
import type { EmailUsageType } from "@prisma/client";

export const limitsRouter = createTRPCRouter({
  // Visão consolidada de uso x limites (página de Uso estilo Resend).
  usageOverview: teamProcedure.query(async ({ ctx }) => {
    const team = ctx.team;
    const plan = team.isActive ? team.plan : "FREE";
    const limits = PLAN_LIMITS[plan];

    const usage = await getThisMonthUsage(team.id);
    const byType = (
      list: { type: EmailUsageType; sent: number }[],
      t: EmailUsageType,
    ) => list.find((x) => x.type === t)?.sent ?? 0;

    // Passo contratado: é ele, e não a chave do plano, que define a cota.
    const sub = await db.subscription.findFirst({
      where: { teamId: team.id, status: { in: ["active", "past_due"] } },
      orderBy: { createdAt: "desc" },
      select: { tier: true },
    });
    const tier = sub?.tier ?? 0;
    const podeExcedente =
      team.planKey !== FREE_PLAN_KEY &&
      team.isActive &&
      cotaMensalDoPlano(team.planKey, tier) !== null;

    const extras = await calcularExtrasDoCiclo(team.id, {
      planKey: team.planKey,
      tier,
      overageEmailsEnabled: team.overageEmailsEnabled,
      dedicatedIpActiveAt: team.dedicatedIpActiveAt,
      dedicatedIpCanceledAt: team.dedicatedIpCanceledAt,
    });

    const [contacts, segments, broadcasts, domains] = await Promise.all([
      db.contact.count({ where: { contactBook: { teamId: team.id } } }),
      db.segment.count({ where: { teamId: team.id } }),
      db.campaign.count({ where: { teamId: team.id } }),
      db.domain.count({ where: { teamId: team.id } }),
    ]);

    return {
      plan,
      transactional: {
        monthly: {
          used: byType(usage.month, "TRANSACTIONAL"),
          limit: limits.emailsPerMonth,
        },
        daily: {
          used: byType(usage.day, "TRANSACTIONAL"),
          limit: plan === "FREE" ? limits.emailsPerDay : team.dailyEmailLimit,
        },
      },
      marketing: {
        contacts: { used: contacts, limit: limits.contacts },
        segments: { used: segments, limit: limits.segments },
        broadcasts: { used: broadcasts, limit: limits.broadcasts },
      },
      team: {
        aiCredits: { used: 0, limit: limits.aiCredits },
        automations: { used: 0, limit: limits.automations },
        domains: { used: domains, limit: limits.domains },
        rateLimit: team.apiRateLimit,
      },
      extras: {
        // Pay-as-you-go so existe para quem tem cota contratada: no Free nao ha
        // "alem da cota", ha upgrade. Ligar o excedente ali seria vender
        // volume sem plano e sem forma de pagamento cadastrada.
        elegivel: podeExcedente,
        transacional: {
          ativo: team.overageEmailsEnabled,
          precoPorMilBRL:
            precoExcedenteBRL(team.planKey, tier) ??
            EXTRAS.transacional.precoPorMilBRL,
          cotaMensal: extras.cotaMensal,
          excedenteAtual: extras.emailsExcedentes,
        },
        automacoes: {
          ativo: team.overageAutomationsEnabled,
          precoPorExecucaoBRL: EXTRAS.automacoes.precoPorExecucaoBRL,
          execucoesInclusas: EXTRAS.automacoes.execucoesInclusas,
        },
        /** O que ja entrou na conta do ciclo corrente, em centavos. */
        acumuladoCents: extras.totalCents,
        detalhe: extras.detalhe,
      },
      addons: {
        ipDedicado: {
          // Sai do catálogo (`scale`/`enterprise`), não do enum FREE/BASIC: o
          // enum não distingue Pro de Scale e liberaria o add-on para o Pro,
          // que no /pricing diz "IPs dedicados: não".
          disponivel: planoTemIpDedicado(team.planKey) && team.isActive,
          planoMinimo: PLANO_MINIMO_IP_DEDICADO,
          precoMensalBRL: ADDONS.ipDedicado.precoMensalBRL,
          solicitadoEm: team.dedicatedIpRequestedAt,
          aquecendoDesde: team.dedicatedIpWarmupStartedAt,
          ativoDesde: team.dedicatedIpActiveAt,
          canceladoEm: team.dedicatedIpCanceledAt,
          endereco: team.dedicatedIpAddress,
        },
      },
    };
  }),

  /**
   * Liga/desliga o pay-as-you-go e pede o add-on de IP dedicado.
   *
   * A trava do plano fica aqui, no servidor, e nao so no `disabled` do switch:
   * o botao cinza da tela nao impede ninguem de chamar a rota.
   */
  setExtras: teamProcedure
    .input(
      z.object({
        transacional: z.boolean().optional(),
        automacoes: z.boolean().optional(),
        ipDedicado: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = ctx.team;
      const noFree = team.planKey === FREE_PLAN_KEY || !team.isActive;

      if ((input.transacional || input.automacoes) && noFree) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "O pay-as-you-go vale a partir de um plano pago. Faça o upgrade para continuar enviando além da cota.",
        });
      }
      if (
        input.ipDedicado &&
        !(planoTemIpDedicado(team.planKey) && team.isActive)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `O IP dedicado está disponível a partir do plano ${PLANO_MINIMO_IP_DEDICADO}.`,
        });
      }

      const agora = new Date();
      await db.team.update({
        where: { id: team.id },
        data: {
          ...(input.transacional === undefined
            ? {}
            : { overageEmailsEnabled: input.transacional }),
          ...(input.automacoes === undefined
            ? {}
            : { overageAutomationsEnabled: input.automacoes }),
          ...(input.ipDedicado === undefined
            ? {}
            : input.ipDedicado
              ? {
                  // Reativar um IP já provisionado é só limpar o cancelamento:
                  // o IP não foi devolvido, não precisa aquecer de novo.
                  dedicatedIpRequestedAt: team.dedicatedIpRequestedAt ?? agora,
                  dedicatedIpCanceledAt: null,
                }
              : team.dedicatedIpActiveAt
                ? {
                    // Já estava em operação: marca a saída em vez de apagar o
                    // `ActiveAt`, senão os dias já entregues neste mês sairiam
                    // de graça da fatura.
                    dedicatedIpCanceledAt: agora,
                  }
                : {
                    // Ainda era só pedido/aquecimento: nada a faturar, some.
                    dedicatedIpRequestedAt: null,
                    dedicatedIpWarmupStartedAt: null,
                  }),
        },
      });

      // Fecha o buraco operacional: o pedido não pode mais ficar silencioso no
      // banco esperando alguém desconfiar.
      if (input.ipDedicado !== undefined) {
        await notificarPedidoIpDedicado(
          input.ipDedicado ? "solicitado" : "cancelado",
          {
            id: team.id,
            name: team.name,
            planKey: team.planKey,
            solicitante: ctx.session.user.email,
          },
        );
      }
      return { success: true };
    }),

  /**
   * Consulta dedicada do limite de membros: o `get` genérico devolve uma
   * união de formatos, e a contagem atual não sobrevive a ela.
   */
  teamMembers: teamProcedure.query(async ({ ctx }) => {
    return LimitService.checkTeamMemberLimit(ctx.team.id);
  }),

  get: teamProcedure
    .input(
      z.object({
        type: z.nativeEnum(LimitReason),
      }),
    )
    .query(async ({ ctx, input }) => {
      switch (input.type) {
        case LimitReason.CONTACT_BOOK:
          return LimitService.checkContactBookLimit(ctx.team.id);
        case LimitReason.DOMAIN:
          return LimitService.checkDomainLimit(ctx.team.id);
        case LimitReason.TEAM_MEMBER:
          return LimitService.checkTeamMemberLimit(ctx.team.id);
        case LimitReason.WEBHOOK:
          return LimitService.checkWebhookLimit(ctx.team.id);
        default:
          // exhaustive guard
          throw new Error("Tipo de limite não suportado");
      }
    }),
});
