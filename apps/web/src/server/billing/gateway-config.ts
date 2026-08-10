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
  /**
   * Parcelas habilitadas, como lista separada por vírgula (ex: "1,2,3").
   * Por padrão só 1x fica ativa — as demais entram desativadas e o admin
   * habilita conscientemente (juros/prazo de repasse mudam por parcela).
   */
  installments?: string;
};

/** Número máximo de parcelas ofertável. */
export const MAX_INSTALLMENTS = 12;

/**
 * Lê as parcelas habilitadas da config. Sempre inclui 1x (à vista não pode ser
 * desligada) e ignora valores fora de 1..MAX_INSTALLMENTS.
 */
export function parseInstallments(raw?: string): number[] {
  if (!raw) return [1];
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_INSTALLMENTS);
  const set = new Set(parsed);
  set.add(1);
  return [...set].sort((a, b) => a - b);
}

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
