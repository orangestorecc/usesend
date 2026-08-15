import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

/**
 * Fila de provisionamento do IP dedicado.
 *
 * Existe para que a transição pedido -> aquecimento -> operação deixe de ser um
 * UPDATE manual no banco de produção. Cada passo carimba o seu próprio campo, e
 * é o `activeAt` que liga a cobrança — por isso ativar é uma ação explícita com
 * o IP em mãos, e não um efeito colateral de abrir a tela.
 */

/** IPv4 simples: o que a AWS devolve num pool dedicado. */
const IPV4 =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

const SELECT = {
  id: true,
  name: true,
  planKey: true,
  isActive: true,
  dedicatedIpRequestedAt: true,
  dedicatedIpWarmupStartedAt: true,
  dedicatedIpActiveAt: true,
  dedicatedIpCanceledAt: true,
  dedicatedIpAddress: true,
} as const;

async function exigirTime(teamId: number) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: SELECT,
  });
  if (!team) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Workspace não encontrado." });
  }
  return team;
}

export const dedicatedIpAdminRouter = createTRPCRouter({
  /** Tudo que tem qualquer marca de IP dedicado, em ordem de chegada. */
  list: adminProcedure.query(async () => {
    const times = await db.team.findMany({
      where: {
        OR: [
          { dedicatedIpRequestedAt: { not: null } },
          { dedicatedIpActiveAt: { not: null } },
        ],
      },
      select: SELECT,
      orderBy: [{ dedicatedIpRequestedAt: "asc" }],
    });

    return times.map((t) => ({
      ...t,
      status: statusDoTime(t),
    }));
  }),

  /** Passo 1: IP provisionado, começa o aquecimento. */
  startWarmup: adminProcedure
    .input(z.object({ teamId: z.number(), address: z.string().regex(IPV4) }))
    .mutation(async ({ input }) => {
      const team = await exigirTime(input.teamId);
      if (!team.dedicatedIpRequestedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este workspace não tem pedido de IP dedicado em aberto.",
        });
      }
      if (team.dedicatedIpActiveAt && !team.dedicatedIpCanceledAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este IP já está em operação.",
        });
      }

      await db.team.update({
        where: { id: input.teamId },
        data: {
          dedicatedIpWarmupStartedAt: new Date(),
          dedicatedIpAddress: input.address,
        },
      });
      return { success: true };
    }),

  /**
   * Passo 2: IP em operação — e é aqui que a cobrança começa.
   *
   * Exige o aquecimento registrado antes: ativar direto do pedido cobraria o
   * cliente por um IP que ninguém confirmou ter provisionado.
   */
  activate: adminProcedure
    .input(z.object({ teamId: z.number() }))
    .mutation(async ({ input }) => {
      const team = await exigirTime(input.teamId);
      if (!team.dedicatedIpWarmupStartedAt || !team.dedicatedIpAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Registre o IP e o início do aquecimento antes de colocar em operação.",
        });
      }
      if (team.dedicatedIpActiveAt && !team.dedicatedIpCanceledAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este IP já está em operação.",
        });
      }

      await db.team.update({
        where: { id: input.teamId },
        data: {
          // Nunca retroage: a cobrança conta a partir de agora, não da data do
          // pedido. Reativação limpa o cancelamento e recomeça o relógio.
          dedicatedIpActiveAt: new Date(),
          dedicatedIpCanceledAt: null,
        },
      });
      return { success: true };
    }),

  /**
   * Encerra o add-on pelo lado do time (IP devolvido, pedido recusado).
   *
   * Mantém `activeAt` quando o IP chegou a operar: o mês corrente ainda fatura
   * os dias entregues, proporcionalmente. Ver overage-service.
   */
  release: adminProcedure
    .input(z.object({ teamId: z.number(), motivo: z.string().max(500).optional() }))
    .mutation(async ({ input }) => {
      const team = await exigirTime(input.teamId);
      const jaOperou = Boolean(team.dedicatedIpActiveAt);

      await db.team.update({
        where: { id: input.teamId },
        data: jaOperou
          ? { dedicatedIpCanceledAt: new Date() }
          : {
              dedicatedIpRequestedAt: null,
              dedicatedIpWarmupStartedAt: null,
              dedicatedIpAddress: null,
            },
      });
      return { success: true };
    }),
});

export type StatusIpDedicado =
  | "solicitado"
  | "aquecendo"
  | "ativo"
  | "cancelado";

export function statusDoTime(t: {
  dedicatedIpRequestedAt: Date | null;
  dedicatedIpWarmupStartedAt: Date | null;
  dedicatedIpActiveAt: Date | null;
  dedicatedIpCanceledAt: Date | null;
}): StatusIpDedicado {
  if (t.dedicatedIpCanceledAt) return "cancelado";
  if (t.dedicatedIpActiveAt) return "ativo";
  if (t.dedicatedIpWarmupStartedAt) return "aquecendo";
  return "solicitado";
}
