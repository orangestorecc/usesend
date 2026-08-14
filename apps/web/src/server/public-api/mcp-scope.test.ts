import { describe, expect, it } from "vitest";
import { mcpScopeAllows } from "./hono";
import type { McpScopes } from "../service/mcp-key-service";

const cheia: McpScopes = {
  contacts: "write",
  lists: "write",
  templates: "write",
  segments: "write",
  campaigns: "write",
  analytics: "read",
  reputation: "read",
  send: true,
};

const soLeitura: McpScopes = {
  ...cheia,
  contacts: "read",
  lists: "read",
  templates: "read",
  segments: "read",
  campaigns: "read",
  send: false,
};

const nada: McpScopes = {
  contacts: "none",
  lists: "none",
  templates: "none",
  segments: "none",
  campaigns: "none",
  analytics: "none",
  reputation: "none",
  send: false,
};

describe("mcpScopeAllows", () => {
  it("libera leitura para chave só-leitura e barra a escrita", () => {
    expect(mcpScopeAllows("GET", "/api/v1/templates", soLeitura)).toBe(true);
    expect(mcpScopeAllows("POST", "/api/v1/templates", soLeitura)).toBe(false);
  });

  it("exige escopo de envio para disparar campanha", () => {
    expect(
      mcpScopeAllows("POST", "/api/v1/campaigns/abc/schedule", soLeitura),
    ).toBe(false);
    expect(
      mcpScopeAllows("POST", "/api/v1/campaigns/abc/schedule", cheia),
    ).toBe(true);
  });

  it("exige escopo de envio para e-mail transacional, mas não para leitura", () => {
    expect(mcpScopeAllows("POST", "/api/v1/emails", soLeitura)).toBe(false);
    expect(mcpScopeAllows("GET", "/api/v1/emails/xyz", soLeitura)).toBe(true);
    expect(mcpScopeAllows("POST", "/api/v1/emails", cheia)).toBe(true);
  });

  it("não entrega corpo de e-mail para chave sem escopo nenhum", () => {
    expect(mcpScopeAllows("GET", "/api/v1/emails/xyz", nada)).toBe(false);
    expect(mcpScopeAllows("GET", "/api/v1/emails", nada)).toBe(false);
  });

  it("deixa cancelar agendamento sem exigir escopo de disparo", () => {
    expect(mcpScopeAllows("POST", "/api/v1/emails/xyz/cancel", soLeitura)).toBe(
      false,
    );
    const podeAlterarCampanhas = { ...soLeitura, campaigns: "write" as const };
    expect(
      mcpScopeAllows("POST", "/api/v1/emails/xyz/cancel", podeAlterarCampanhas),
    ).toBe(true);
  });

  it("preenche escopo ausente de chave antiga em vez de negar em silêncio", () => {
    // Chave gravada antes de o campo existir: a propriedade nem está no JSON.
    const legado = { ...cheia };
    delete legado.reputation;
    expect(mcpScopeAllows("GET", "/api/v1/reputation/status", legado)).toBe(
      false,
    );
    // É isso que o merge com DEFAULT_SCOPES em getTeamAndMcpKey resolve.
    const aposMerge: McpScopes = { reputation: "read", ...legado };
    expect(mcpScopeAllows("GET", "/api/v1/reputation/status", aposMerge)).toBe(
      true,
    );
  });

  it("mantém domínios como leitura, nunca escrita", () => {
    expect(mcpScopeAllows("GET", "/api/v1/domains", nada)).toBe(true);
    expect(mcpScopeAllows("POST", "/api/v1/domains", cheia)).toBe(false);
  });

  it("respeita o escopo de entregabilidade em vez de liberar por omissão", () => {
    expect(mcpScopeAllows("GET", "/api/v1/reputation/status", cheia)).toBe(true);
    expect(mcpScopeAllows("GET", "/api/v1/reputation/status", nada)).toBe(false);
  });

  it("trata disparo de evento como envio, porque ele aciona automações", () => {
    expect(mcpScopeAllows("POST", "/api/v1/events/send", soLeitura)).toBe(false);
    expect(mcpScopeAllows("POST", "/api/v1/events/send", cheia)).toBe(true);
  });

  it("nega rota /v1 desconhecida em vez de liberar por padrão", () => {
    expect(mcpScopeAllows("GET", "/api/v1/rota-nova-qualquer", cheia)).toBe(
      false,
    );
  });

  it("mantém /v1/mcp/me aberto — é como o servidor resolve os próprios escopos", () => {
    expect(mcpScopeAllows("GET", "/api/v1/mcp/me", nada)).toBe(true);
  });
});
