// Cliente fino da API pública v1 do useSend.
// Cada instância carrega a API key de UM cliente (team) -> isolamento multi-tenant.

export type Contact = {
  email: string;
  firstName?: string;
  lastName?: string;
  properties?: Record<string, string>;
  subscribed?: boolean;
};

export type ScopeLevel = "none" | "read" | "write";
export type McpScopes = {
  contacts: ScopeLevel;
  lists: ScopeLevel;
  templates: ScopeLevel;
  segments: ScopeLevel;
  campaigns: ScopeLevel;
  analytics: "none" | "read";
  reputation?: "none" | "read";
  send: boolean;
  plan?: { pricePerContactBRL: number; minContacts: number };
};

// Erro de resposta da API do useSend, com o status HTTP preservado.
// Sem isso o chamador não distingue "token inválido" (401/403) de falha
// transitória (429/5xx/timeout), e trata infra instável como token ruim.
export class UseSendHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UseSendHttpError";
  }
}

export class UseSendClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private async req(method: string, path: string, body?: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new UseSendHttpError(
        `useSend ${method} ${path} -> ${res.status}: ${
          typeof data === "string" ? data : JSON.stringify(data)
        }`,
        res.status,
      );
    }
    return data;
  }

  // ---- Listas (contact books) ----
  listContactBooks() {
    return this.req("GET", "/v1/contactBooks");
  }
  createContactBook(input: {
    name: string;
    emoji?: string;
    properties?: Record<string, string>;
  }) {
    return this.req("POST", "/v1/contactBooks", input);
  }
  listContacts(bookId: string) {
    return this.req("GET", `/v1/contactBooks/${bookId}/contacts`);
  }
  getContact(bookId: string, contactId: string) {
    return this.req("GET", `/v1/contactBooks/${bookId}/contacts/${contactId}`);
  }
  updateContact(
    bookId: string,
    contactId: string,
    data: Record<string, unknown>,
  ) {
    return this.req(
      "PATCH",
      `/v1/contactBooks/${bookId}/contacts/${contactId}`,
      data,
    );
  }
  deleteContact(bookId: string, contactId: string) {
    return this.req(
      "DELETE",
      `/v1/contactBooks/${bookId}/contacts/${contactId}`,
    );
  }
  bulkAddContacts(bookId: string, contacts: Contact[]) {
    return this.req(
      "POST",
      `/v1/contactBooks/${bookId}/contacts/bulk`,
      contacts,
    );
  }

  // ---- Campanhas ----
  listCampaigns() {
    return this.req("GET", "/v1/campaigns");
  }
  getCampaign(id: string) {
    return this.req("GET", `/v1/campaigns/${id}`);
  }
  createCampaign(input: Record<string, unknown>) {
    return this.req("POST", "/v1/campaigns", input);
  }
  scheduleCampaign(id: string, scheduledAt?: string) {
    return this.req("POST", `/v1/campaigns/${id}/schedule`, { scheduledAt });
  }
  pauseCampaign(id: string) {
    return this.req("POST", `/v1/campaigns/${id}/pause`);
  }
  resumeCampaign(id: string) {
    return this.req("POST", `/v1/campaigns/${id}/resume`);
  }

  // ---- Domínios ----
  listDomains() {
    return this.req("GET", "/v1/domains");
  }
  getDomain(id: number) {
    return this.req("GET", `/v1/domains/${id}`);
  }

  // ---- Transacional ----
  sendEmail(input: Record<string, unknown>) {
    return this.req("POST", "/v1/emails", input);
  }
  getEmail(id: string) {
    return this.req("GET", `/v1/emails/${id}`);
  }
  cancelEmail(id: string) {
    return this.req("POST", `/v1/emails/${id}/cancel`);
  }

  // ---- Templates ----
  listTemplates() {
    return this.req("GET", "/v1/templates");
  }
  getTemplate(id: string) {
    return this.req("GET", `/v1/templates/${id}`);
  }
  createTemplate(input: {
    name: string;
    subject: string;
    content?: string;
    html?: string;
  }) {
    return this.req("POST", "/v1/templates", input);
  }
  renderTemplate(content: string) {
    return this.req("POST", "/v1/templates/render", { content });
  }

  // Resolve o token MCP atual -> time + escopos (via useSend).
  getMcpMe() {
    return this.req("GET", "/v1/mcp/me") as Promise<{
      teamId: number;
      teamName: string;
      scopes: McpScopes;
    }>;
  }

  // Conta o total de contatos do time (soma _count.contacts das listas).
  async countContacts(): Promise<number> {
    const books = (await this.listContactBooks()) as Array<{
      _count?: { contacts?: number };
    }>;
    if (!Array.isArray(books)) return 0;
    return books.reduce((sum, b) => sum + (b._count?.contacts ?? 0), 0);
  }

  // ---- Segmentos ----
  listSegments() {
    return this.req("GET", "/v1/segments");
  }
  createSegment(input: {
    name: string;
    contactBookId?: string;
    rules: unknown;
  }) {
    return this.req("POST", "/v1/segments", input);
  }
  previewSegment(id: string) {
    return this.req("POST", `/v1/segments/${id}/preview`, {});
  }
  materializeSegment(id: string, name: string) {
    return this.req("POST", `/v1/segments/${id}/materialize`, { name });
  }
  deleteSegment(id: string) {
    return this.req("DELETE", `/v1/segments/${id}`);
  }

  // ---- Analytics ----
  emailTimeSeries(days?: number) {
    const q = days ? `?days=${days}` : "";
    return this.req("GET", `/v1/analytics/email-time-series${q}`);
  }
  reputationMetrics() {
    return this.req("GET", "/v1/analytics/reputation-metrics");
  }

  // ---- Entregabilidade (só leitura) ----
  reputationStatus() {
    return this.req("GET", "/v1/reputation/status");
  }
  bounceBreakdown() {
    return this.req("GET", "/v1/reputation/bounce-breakdown");
  }
}
