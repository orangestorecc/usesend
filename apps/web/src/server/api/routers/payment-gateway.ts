import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { encryptSecret, decryptSecret } from "~/server/crypto";

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
});
