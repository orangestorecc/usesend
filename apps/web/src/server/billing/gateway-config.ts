import { db } from "~/server/db";
import { decryptSecret } from "~/server/crypto";

/**
 * Credenciais dos gateways (armazenadas cifradas em PaymentGatewayConfig.configEnc).
 * Campos batem com o admin em /admin/payments.
 */
export type InterConfig = {
  clientId?: string;
  clientSecret?: string;
  pixKey?: string;
  certificate?: string; // conteúdo do .crt (PEM)
  privateKey?: string; // conteúdo do .key (PEM)
};

export type RedeConfig = {
  pv?: string;
  token?: string;
};

type ConfigMap = {
  inter: InterConfig;
  rede: RedeConfig;
};

/**
 * Lê e descriptografa a config de um gateway. Retorna null se não existir linha.
 */
export async function getGatewayConfig<P extends keyof ConfigMap>(
  provider: P,
): Promise<{ enabled: boolean; config: ConfigMap[P] } | null> {
  const row = await db.paymentGatewayConfig.findUnique({ where: { provider } });
  if (!row) return null;
  let config = {} as ConfigMap[P];
  if (row.configEnc) {
    try {
      config = JSON.parse(decryptSecret(row.configEnc)) as ConfigMap[P];
    } catch {
      config = {} as ConfigMap[P];
    }
  }
  return { enabled: row.enabled, config };
}

/**
 * Lê a config e garante que o gateway está habilitado + com credenciais mínimas.
 * Lança erro amigável caso contrário.
 */
export async function requireGateway<P extends keyof ConfigMap>(
  provider: P,
  requiredKeys: (keyof ConfigMap[P])[],
): Promise<ConfigMap[P]> {
  const row = await getGatewayConfig(provider);
  if (!row || !row.enabled) {
    throw new Error(
      `Gateway "${provider}" não está habilitado. Configure em Admin > Pagamentos.`,
    );
  }
  const missing = requiredKeys.filter((k) => !row.config[k]);
  if (missing.length) {
    throw new Error(
      `Gateway "${provider}" sem credenciais: ${missing.join(", ")}.`,
    );
  }
  return row.config;
}

/** true quando rodando contra sandbox/homologação dos gateways. */
export function isPaymentsSandbox(): boolean {
  return process.env.PAYMENTS_SANDBOX === "true";
}
