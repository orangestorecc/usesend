import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre o que quebrou o PIX em produção em 13/08/2026: a cobrança era criada
 * com sucesso no Inter, mas o checkout exibia o bloco de pagamento sem chave e
 * sem QR. Duas causas, ambas silenciosas.
 */

const requireGateway = vi.fn();
vi.mock("./gateway-config", () => ({
  requireGateway: (...args: unknown[]) => requireGateway(...args),
  isPaymentsSandbox: () => false,
}));
vi.mock("./gateway-log", () => ({ logGatewayCall: vi.fn() }));

/** Respostas do Inter por caminho, na ordem em que o adapter as pede. */
let respostas: Record<string, { status: number; json: unknown }>;

vi.mock("node:https", () => ({
  default: {
    request: (opts: { path: string }, cb: (res: unknown) => void) => {
      const resposta = respostas[opts.path] ?? { status: 404, json: null };
      const corpo = JSON.stringify(resposta.json);
      const handlers: Record<string, (arg?: unknown) => void> = {};
      queueMicrotask(() => {
        cb({
          statusCode: resposta.status,
          on: (evento: string, fn: (arg?: unknown) => void) => {
            handlers[evento] = fn;
            if (evento === "end") {
              handlers.data?.(corpo);
              fn();
            }
          },
        });
      });
      return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
    },
  },
}));

const { createPixCharge } = await import("./inter");

const TOKEN = { status: 200, json: { access_token: "t", expires_in: 3600 } };

beforeEach(() => {
  requireGateway.mockResolvedValue({
    clientId: "id",
    clientSecret: "segredo",
    certificate: "cert",
    privateKey: "key",
    pixKey: "chave@madmail.com.br",
  });
});

describe("cobrança PIX no Inter", () => {
  it("lê o copia-e-cola na grafia que o Inter devolve (pixCopiaECola)", async () => {
    // O adapter lia "pixCopiaeCola", com "e" minúsculo. O campo vinha vazio e
    // o cliente ficava sem nada para colar no app do banco.
    respostas = {
      "/oauth/v2/token": TOKEN,
      "/pix/v2/cob": {
        status: 201,
        json: {
          txid: "abc123",
          pixCopiaECola: "00020126PAYLOAD-EMV",
          loc: { id: 245442080 },
        },
      },
    };

    const cobranca = await createPixCharge({ amountCents: 20000 });

    expect(cobranca.copiaECola).toBe("00020126PAYLOAD-EMV");
  });

  it("gera o QR a partir do copia-e-cola, sem chamar o banco", async () => {
    // GET /pix/v2/loc/{id}/qrcode não existe no Inter e respondia 404. Como
    // nenhuma resposta é registrada para esse caminho, o mock devolve 404 — se
    // o adapter voltar a depender dele, o QR volta a ser nulo e o teste falha.
    respostas = {
      "/oauth/v2/token": TOKEN,
      "/pix/v2/cob": {
        status: 201,
        json: {
          txid: "abc123",
          pixCopiaECola: "00020126PAYLOAD-EMV",
          loc: { id: 245442080 },
        },
      },
    };

    const cobranca = await createPixCharge({ amountCents: 20000 });

    expect(cobranca.qrImage).toMatch(/^data:image\/png;base64,/);
  });

  it("falha alto quando a cobrança vem sem copia-e-cola", async () => {
    // Sem ele não há como pagar. Melhor estourar no checkout do que devolver
    // uma tela de pagamento vazia, que foi o sintoma relatado.
    respostas = {
      "/oauth/v2/token": TOKEN,
      "/pix/v2/cob": { status: 201, json: { txid: "abc123", loc: { id: 1 } } },
    };

    await expect(createPixCharge({ amountCents: 20000 })).rejects.toThrow(
      /copia-e-cola/,
    );
  });
});
