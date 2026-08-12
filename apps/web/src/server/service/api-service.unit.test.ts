import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Guarda contra a regressão que fazia o relay SMTP reenviar para sempre.
 *
 * Um token fora do formato `prefixo_clientId_segredo` chegava no Prisma com
 * clientId undefined, o findUnique lançava erro de validação, e a API devolvia
 * 500. O relay traduz 5xx da nossa API para falha temporária, então um cliente
 * com a senha errada ficava reenviando indefinidamente.
 */

const mockFindUnique = vi.fn();

vi.mock("../db", () => ({
  db: {
    apiKey: { findUnique: (...a: unknown[]) => mockFindUnique(...a), update: vi.fn() },
    team: { findUnique: vi.fn() },
  },
}));
vi.mock("../logger/log", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

const { getTeamAndApiKey } = await import("./api-service");

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue(null);
});

describe("getTeamAndApiKey", () => {
  it("devolve null para texto sem underscore, sem consultar o banco", async () => {
    await expect(getTeamAndApiKey("chave-de-teste")).resolves.toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("devolve null para senha em branco", async () => {
    await expect(getTeamAndApiKey("")).resolves.toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("devolve null quando falta o segredo depois do clientId", async () => {
    await expect(getTeamAndApiKey("us_apenasClientId")).resolves.toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("consulta o banco quando o formato está certo", async () => {
    await getTeamAndApiKey("us_cliente123_segredo456");
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "cliente123" } }),
    );
  });
});
