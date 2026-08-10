import https from "node:https";
import { requireGateway, isPaymentsSandbox, type InterConfig } from "./gateway-config";

/**
 * Adapter do Banco Inter (API PIX + API Cobrança/boleto).
 * Autenticação: OAuth client_credentials + mTLS (certificado do cliente).
 * Docs: https://developers.inter.co/
 *
 * NOTA: os nomes de campo abaixo seguem a doc pública do Inter (cdpj). Ao ligar
 * as credenciais reais em homologação, valide o shape de resposta — pontos a
 * conferir estão marcados com CONFERIR.
 */

const BASE = () =>
  isPaymentsSandbox()
    ? "https://cdpj-sandbox.partners.uatinter.co"
    : "https://cdpj.partners.bancointer.com.br";

type InterResponse = { status: number; json: any; text: string };

/**
 * Requisição HTTPS com mTLS (cert/key do cliente Inter em PEM).
 */
function interRequest(
  cfg: InterConfig,
  opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
    form?: Record<string, string>;
  },
): Promise<InterResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE() + opts.path);
    const payload = opts.form
      ? new URLSearchParams(opts.form).toString()
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(opts.form
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : opts.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      ...(opts.headers ?? {}),
    };
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload).toString();

    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: opts.method,
        headers,
        cert: cfg.certificate,
        key: cfg.privateKey,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json: any = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode ?? 0, json, text: data });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Cache de token em memória por clientId.
const tokenCache = new Map<string, { token: string; exp: number }>();

async function getToken(cfg: InterConfig, scope: string): Promise<string> {
  const cacheKey = `${cfg.clientId}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 30 > now) return cached.token;

  const res = await interRequest(cfg, {
    method: "POST",
    path: "/oauth/v2/token",
    form: {
      client_id: cfg.clientId!,
      client_secret: cfg.clientSecret!,
      grant_type: "client_credentials",
      scope,
    },
  });
  if (res.status >= 300 || !res.json?.access_token) {
    throw new Error(
      `Inter OAuth falhou (${res.status}): ${res.text?.slice(0, 300)}`,
    );
  }
  tokenCache.set(cacheKey, {
    token: res.json.access_token,
    exp: now + (res.json.expires_in ?? 3600),
  });
  return res.json.access_token;
}

export type PixChargeInput = {
  amountCents: number;
  description?: string;
  payer?: { name?: string; document?: string };
  expiresInSeconds?: number;
};

export type PixChargeResult = {
  txid: string;
  copiaECola: string;
  qrImage: string | null; // data URI base64
  locId?: number;
};

/**
 * Cria cobrança PIX imediata. Retorna o copia-e-cola + imagem do QR.
 */
export async function createPixCharge(
  input: PixChargeInput,
): Promise<PixChargeResult> {
  const cfg = await requireGateway("inter", [
    "clientId",
    "clientSecret",
    "certificate",
    "privateKey",
    "pixKey",
  ]);
  const token = await getToken(cfg, "cob.write cob.read");

  const valor = (input.amountCents / 100).toFixed(2);
  const body: Record<string, unknown> = {
    calendario: { expiracao: input.expiresInSeconds ?? 3600 },
    valor: { original: valor },
    chave: cfg.pixKey,
    solicitacaoPagador: input.description?.slice(0, 140),
  };
  if (input.payer?.document) {
    const doc = input.payer.document.replace(/\D/g, "");
    body.devedor =
      doc.length > 11
        ? { cnpj: doc, nome: input.payer.name ?? "Cliente" }
        : { cpf: doc, nome: input.payer.name ?? "Cliente" };
  }

  const res = await interRequest(cfg, {
    method: "POST",
    path: "/pix/v2/cob",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (res.status >= 300 || !res.json?.txid) {
    throw new Error(
      `Inter PIX falhou (${res.status}): ${res.text?.slice(0, 300)}`,
    );
  }

  const txid: string = res.json.txid;
  const copiaECola: string = res.json.pixCopiaeCola ?? "";
  const locId: number | undefined = res.json.loc?.id;

  // Busca a imagem do QR (base64) a partir do location.
  let qrImage: string | null = null;
  if (locId) {
    try {
      const qr = await interRequest(cfg, {
        method: "GET",
        path: `/pix/v2/loc/${locId}/qrcode`,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (qr.json?.imagemQrcode) {
        qrImage = qr.json.imagemQrcode.startsWith("data:")
          ? qr.json.imagemQrcode
          : `data:image/png;base64,${qr.json.imagemQrcode}`;
      }
    } catch {
      // segue sem imagem — o copia-e-cola já basta
    }
  }

  return { txid, copiaECola, qrImage, locId };
}

export type BoletoChargeInput = {
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  seuNumero: string; // identificador nosso (<= 15 chars)
  payer: {
    name: string;
    document: string; // CPF/CNPJ
    personType?: "PF" | "PJ";
    postalCode?: string;
    address?: string;
    city?: string;
    state?: string;
  };
};

export type BoletoChargeResult = {
  codigoSolicitacao: string;
  linhaDigitavel: string | null;
  pdfUrl: string | null;
  copiaECola: string | null; // Inter emite boleto híbrido com PIX
};

/**
 * Emite boleto (API Cobrança v3). Retorna código da solicitação + linha digitável.
 */
export async function createBoleto(
  input: BoletoChargeInput,
): Promise<BoletoChargeResult> {
  const cfg = await requireGateway("inter", [
    "clientId",
    "clientSecret",
    "certificate",
    "privateKey",
  ]);
  const token = await getToken(
    cfg,
    "boleto-cobranca.write boleto-cobranca.read",
  );

  const doc = input.payer.document.replace(/\D/g, "");
  const body = {
    seuNumero: input.seuNumero.slice(0, 15),
    valorNominal: Number((input.amountCents / 100).toFixed(2)),
    dataVencimento: input.dueDate,
    numDiasAgenda: 30,
    pagador: {
      cpfCnpj: doc,
      tipoPessoa: doc.length > 11 ? "JURIDICA" : "FISICA",
      nome: input.payer.name,
      endereco: input.payer.address ?? "Não informado",
      cidade: input.payer.city ?? "Não informado",
      uf: input.payer.state ?? "SP",
      cep: (input.payer.postalCode ?? "00000000").replace(/\D/g, ""),
    },
  };

  const res = await interRequest(cfg, {
    method: "POST",
    path: "/cobranca/v3/cobrancas",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (res.status >= 300 || !res.json?.codigoSolicitacao) {
    throw new Error(
      `Inter Boleto falhou (${res.status}): ${res.text?.slice(0, 300)}`,
    );
  }

  const codigoSolicitacao: string = res.json.codigoSolicitacao;

  // Recupera detalhes (linha digitável / pix do boleto híbrido).
  let linhaDigitavel: string | null = null;
  let copiaECola: string | null = null;
  try {
    const detail = await interRequest(cfg, {
      method: "GET",
      path: `/cobranca/v3/cobrancas/${codigoSolicitacao}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    linhaDigitavel = detail.json?.boleto?.linhaDigitavel ?? null;
    copiaECola = detail.json?.pix?.pixCopiaeCola ?? null;
  } catch {
    // segue — o cliente pode buscar o PDF pelo código
  }

  const pdfUrl = `${BASE()}/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`;

  return { codigoSolicitacao, linhaDigitavel, pdfUrl, copiaECola };
}
