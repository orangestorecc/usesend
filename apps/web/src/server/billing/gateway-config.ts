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
  /** Juros por parcela: "2:1.99,3:1.99" (parcelas : % ao mês). */
  installmentRates?: string;
};

/** Número máximo de parcelas ofertável. */
export const MAX_INSTALLMENTS = 12;

/**
 * Juros por parcela, no formato "2:1.99;3:1.99;6:2.5" — parcelas : taxa ao
 * mês em %. Parcela sem entrada na lista é sem juros.
 *
 * O separador é ponto e vírgula, não vírgula: em pt-BR a vírgula é decimal, e
 * "2:1,99" seria lido como 1% em vez de 1,99% — cobrança errada e silenciosa.
 */
export function parseInstallmentRates(raw?: string): Record<number, number> {
  const mapa: Record<number, number> = {};
  if (!raw) return mapa;
  for (const par of raw.split(";")) {
    const [n, taxa] = par.split(":").map((s) => s.trim());
    const parcelas = Number(n);
    const juros = Number(String(taxa).replace(",", "."));
    if (
      Number.isInteger(parcelas) &&
      parcelas > 1 &&
      parcelas <= MAX_INSTALLMENTS &&
      Number.isFinite(juros) &&
      juros > 0
    ) {
      mapa[parcelas] = juros;
    }
  }
  return mapa;
}

export function serializeInstallmentRates(
  mapa: Record<number, number>,
): string {
  return Object.entries(mapa)
    .filter(([, taxa]) => Number(taxa) > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([n, taxa]) => `${n}:${taxa}`)
    .join(";");
}

export type InstallmentOption = {
  parcelas: number;
  /** Juros ao mês aplicado (0 = sem juros). */
  jurosAoMes: number;
  /** Valor de cada parcela, em centavos. */
  valorParcelaCents: number;
  /** Total a pagar, em centavos. */
  totalCents: number;
  semJuros: boolean;
};

/**
 * Calcula o valor das parcelas pela Tabela Price, que é como o mercado
 * brasileiro expressa juros de cartão ("1,99% a.m.").
 *
 *   parcela = PV × i / (1 − (1+i)^−n)
 *
 * Sem juros, divide o total igualmente e joga a sobra de centavos na
 * primeira parcela — senão a soma das parcelas não fecha com o total.
 */
export function calcularParcela(
  amountCents: number,
  parcelas: number,
  jurosAoMesPercent: number,
): InstallmentOption {
  if (parcelas <= 1 || jurosAoMesPercent <= 0) {
    const valor = Math.round(amountCents / parcelas);
    return {
      parcelas,
      jurosAoMes: 0,
      valorParcelaCents: valor,
      totalCents: amountCents,
      semJuros: true,
    };
  }

  const i = jurosAoMesPercent / 100;
  const fator = i / (1 - Math.pow(1 + i, -parcelas));
  const valorParcela = Math.round(amountCents * fator);

  return {
    parcelas,
    jurosAoMes: jurosAoMesPercent,
    valorParcelaCents: valorParcela,
    totalCents: valorParcela * parcelas,
    semJuros: false,
  };
}

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
