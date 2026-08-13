import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import * as inter from "~/server/billing/inter";
import { db } from "~/server/db";
import { encryptSecret, decryptSecret } from "~/server/crypto";
import { env } from "~/env";
import { getLogRetentionDays } from "~/server/billing/gateway-log";

const PROVIDERS = ["inter", "rede"] as const;
type Provider = (typeof PROVIDERS)[number];

// Campos sensíveis por provider — mascarados na leitura, preservados se vierem vazios.
const SECRETS: Record<Provider, string[]> = {
  inter: ["clientSecret", "privateKey"],
  rede: ["token"],
};

function readConfig(configEnc: string | null): Record<string, string> {
  if (!configEnc) return {};
  try {
    return JSON.parse(decryptSecret(configEnc)) as Record<string, string>;
  } catch {
    return {};
  }
}

export const paymentGatewayRouter = createTRPCRouter({
  get: adminProcedure
    .input(z.object({ provider: z.enum(PROVIDERS) }))
    .query(async ({ input }) => {
      const row = await db.paymentGatewayConfig.findUnique({
        where: { provider: input.provider },
      });
      const config = readConfig(row?.configEnc ?? null);
      const secrets = SECRETS[input.provider];
      const masked: Record<string, string> = {};
      const has: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(config)) {
        if (secrets.includes(k)) {
          has[k] = Boolean(v);
          masked[k] = "";
        } else {
          masked[k] = v;
        }
      }
      return { enabled: row?.enabled ?? false, config: masked, has };
    }),

  update: adminProcedure
    .input(
      z.object({
        provider: z.enum(PROVIDERS),
        enabled: z.boolean(),
        config: z.record(z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      const existingRow = await db.paymentGatewayConfig.findUnique({
        where: { provider: input.provider },
      });
      const existing = readConfig(existingRow?.configEnc ?? null);
      const secrets = SECRETS[input.provider];
      const merged: Record<string, string> = { ...existing };
      for (const [k, v] of Object.entries(input.config)) {
        if (secrets.includes(k) && !v) continue; // mantém o segredo atual
        merged[k] = v;
      }
      const configEnc = encryptSecret(JSON.stringify(merged));
      await db.paymentGatewayConfig.upsert({
        where: { provider: input.provider },
        create: { provider: input.provider, enabled: input.enabled, configEnc },
        update: { enabled: input.enabled, configEnc },
      });
      return { success: true };
    }),

  /** URLs de webhook a cadastrar no painel de cada provedor. */
  webhookUrls: adminProcedure.query(() => {
    const base = env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
    const token = env.PAYMENTS_WEBHOOK_TOKEN;
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    return {
      inter: `${base}/api/webhook/inter${qs}`,
      rede: `${base}/api/webhook/rede${qs}`,
      protected: Boolean(token),
    };
  }),

  /**
   * Webhook PIX cadastrado hoje no Inter.
   *
   * O Inter só avisa quem se cadastrou por API — não basta a URL existir do
   * nosso lado. Um pagamento real ficou preso em "pendente" por isso, então
   * dá para conferir o estado sem abrir log.
   */
  statusWebhookInter: adminProcedure.query(async () => {
    try {
      const { status, webhookUrl } = await inter.consultarWebhookPix();
      return {
        cadastrado: status < 300 && Boolean(webhookUrl),
        webhookUrl,
        erro: null as string | null,
      };
    } catch (e) {
      return {
        cadastrado: false,
        webhookUrl: null,
        erro: e instanceof Error ? e.message : "falha ao consultar",
      };
    }
  }),

  /** Cadastra no Inter a URL que ele deve chamar quando o PIX for pago. */
  registrarWebhookInter: adminProcedure.mutation(async () => {
    const base = env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
    if (!base.startsWith("https://")) {
      // O Inter recusa destino sem TLS, e falharia com uma mensagem opaca.
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "O Inter só aceita webhook em HTTPS. Confira o NEXTAUTH_URL.",
      });
    }
    const token = env.PAYMENTS_WEBHOOK_TOKEN;
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${base}/api/webhook/inter${qs}`;

    const { ok, status } = await inter.registrarWebhookPix(url);
    if (!ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `O Inter recusou o cadastro do webhook (HTTP ${status}).`,
      });
    }
    return { webhookUrl: url };
  }),

  /** Log de transações (chamadas ao gateway + webhooks recebidos). */
  logs: adminProcedure
    .input(
      z.object({
        provider: z.enum(PROVIDERS),
        direction: z.enum(["all", "outbound", "inbound"]).default("all"),
        status: z.enum(["all", "success", "error"]).default("all"),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
      }),
    )
    .query(async ({ input }) => {
      const perPage = 25;
      const where: Prisma.PaymentGatewayLogWhereInput = {
        provider: input.provider,
        ...(input.direction !== "all" ? { direction: input.direction } : {}),
        ...(input.status !== "all"
          ? { success: input.status === "success" }
          : {}),
        ...(input.search
          ? {
              OR: [
                { url: { contains: input.search, mode: "insensitive" } },
                { operation: { contains: input.search, mode: "insensitive" } },
                { chargeId: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [logs, total] = await Promise.all([
        db.paymentGatewayLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * perPage,
          take: perPage,
        }),
        db.paymentGatewayLog.count({ where }),
      ]);

      return {
        logs,
        total,
        page: input.page,
        perPage,
        retentionDays: getLogRetentionDays(),
      };
    }),

  /** Cartões tokenizados guardados para recorrência (sem PAN — só metadados). */
  tokenizedCards: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
      }),
    )
    .query(async ({ input }) => {
      const perPage = 25;
      const where: Prisma.PaymentMethodWhereInput = {
        type: "card",
        ...(input.search
          ? {
              OR: [
                { last4: { contains: input.search } },
                { brand: { contains: input.search, mode: "insensitive" } },
                { holderName: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [cards, total] = await Promise.all([
        db.paymentMethod.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * perPage,
          take: perPage,
          select: {
            id: true,
            teamId: true,
            provider: true,
            brand: true,
            last4: true,
            expMonth: true,
            expYear: true,
            holderName: true,
            isDefault: true,
            createdAt: true,
          },
        }),
        db.paymentMethod.count({ where }),
      ]);

      const teamIds = [...new Set(cards.map((c) => c.teamId))];
      const teams = await db.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true },
      });
      const teamName = new Map(teams.map((t) => [t.id, t.name]));

      return {
        cards: cards.map((c) => ({
          ...c,
          teamName: teamName.get(c.teamId) ?? `Time #${c.teamId}`,
        })),
        total,
        page: input.page,
        perPage,
      };
    }),

  /** Remove um cartão tokenizado (revoga o uso em recorrências futuras). */
  deleteTokenizedCard: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const card = await db.paymentMethod.findUnique({
        where: { id: input.id },
      });
      if (!card) throw new Error("Cartão não encontrado.");
      await db.paymentMethod.delete({ where: { id: input.id } });

      // Se era o padrão, promove o mais recente do mesmo time.
      if (card.isDefault) {
        const next = await db.paymentMethod.findFirst({
          where: { teamId: card.teamId, type: "card" },
          orderBy: { createdAt: "desc" },
        });
        if (next) {
          await db.paymentMethod.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
      return { success: true };
    }),
});
