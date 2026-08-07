import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UseSendClient, type Contact } from "./usesend.js";
import type { ClientBilling } from "./billing.js";

type LogFn = (tool: string, args: unknown, status: "ok" | "error") => void;

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const err = (message: string) => ({
  content: [{ type: "text" as const, text: `ERRO: ${message}` }],
  isError: true,
});

// Wrap: loga uso e trata erro de forma uniforme.
function wrap<T>(
  log: LogFn,
  tool: string,
  fn: (args: T) => Promise<unknown>,
) {
  return async (args: T) => {
    try {
      const data = await fn(args);
      log(tool, args, "ok");
      return ok(data);
    } catch (e) {
      log(tool, args, "error");
      return err(e instanceof Error ? e.message : String(e));
    }
  };
}

export function registerTools(
  server: McpServer,
  client: UseSendClient,
  log: LogFn,
  bill: ClientBilling,
) {
  // ============ 🟢 LEITURA ============
  server.tool(
    "get_usage",
    "Mostra o consumo do cliente: nº de contatos atuais, plano e custo mensal estimado (cobrança por contato).",
    {},
    wrap(log, "get_usage", async () =>
      bill.summary(await client.countContacts()),
    ),
  );

  server.tool(
    "billing_summary",
    "Resumo de cobrança: plano, preço por contato, contatos atuais, contatos faturáveis (respeita mínimo) e custo mensal em BRL.",
    {},
    wrap(log, "billing_summary", async () =>
      bill.summary(await client.countContacts()),
    ),
  );

  server.tool(
    "list_lists",
    "Lista as listas de contatos (contact books) do cliente.",
    {},
    wrap(log, "list_lists", () => client.listContactBooks()),
  );

  server.tool(
    "list_contacts",
    "Lista os contatos de uma lista.",
    { listId: z.string().describe("ID da lista (contact book)") },
    wrap(log, "list_contacts", ({ listId }) => client.listContacts(listId)),
  );

  server.tool(
    "list_campaigns",
    "Lista as campanhas do cliente.",
    {},
    wrap(log, "list_campaigns", () => client.listCampaigns()),
  );

  server.tool(
    "get_campaign_report",
    "Relatório de uma campanha: enviados, entregues, abertos, cliques, bounces.",
    { campaignId: z.string() },
    wrap(log, "get_campaign_report", ({ campaignId }) =>
      client.getCampaign(campaignId),
    ),
  );

  server.tool(
    "get_analytics",
    "Métricas da conta. type='timeseries' (série temporal de e-mails) ou 'reputation' (reputação).",
    {
      type: z.enum(["timeseries", "reputation"]).default("timeseries"),
      days: z.number().int().positive().optional(),
    },
    wrap(log, "get_analytics", ({ type, days }) =>
      type === "reputation"
        ? client.reputationMetrics()
        : client.emailTimeSeries(days),
    ),
  );

  server.tool(
    "list_templates",
    "Lista os templates de e-mail do cliente.",
    {},
    wrap(log, "list_templates", () => client.listTemplates()),
  );

  server.tool(
    "get_template",
    "Retorna um template (inclui content JSON e html renderizado).",
    { templateId: z.string() },
    wrap(log, "get_template", ({ templateId }) => client.getTemplate(templateId)),
  );

  server.tool(
    "render_preview",
    "Renderiza um JSON do editor (TipTap) para HTML, SEM salvar. Use para pré-visualizar o e-mail que a IA montou antes de salvar/enviar.",
    { content: z.string().describe("JSON do editor (TipTap)") },
    wrap(log, "render_preview", ({ content }) => client.renderTemplate(content)),
  );

  // ============ 🟡 ESCRITA REVERSÍVEL ============
  server.tool(
    "save_template",
    "Salva um template de e-mail. Passe content (JSON do editor TipTap, preferido — fica editável) ou html. Retorna o template com id e html renderizado.",
    {
      name: z.string(),
      subject: z.string(),
      content: z.string().optional().describe("JSON do editor (TipTap). Preferido."),
      html: z.string().optional().describe("HTML pronto, alternativa a content."),
    },
    wrap(log, "save_template", (input) => client.createTemplate(input)),
  );

  server.tool(
    "create_list",
    "Cria uma lista de contatos (contact book).",
    {
      name: z.string(),
      emoji: z.string().optional(),
      properties: z
        .record(z.string())
        .optional()
        .describe("Propriedades customizadas dos contatos, ex.: {cidade:'texto'}"),
    },
    wrap(log, "create_list", (input) => client.createContactBook(input)),
  );

  server.tool(
    "import_contacts",
    "Adiciona/atualiza contatos em uma lista (em lote, até 1000).",
    {
      listId: z.string(),
      contacts: z
        .array(
          z.object({
            email: z.string(),
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            properties: z.record(z.string()).optional(),
            subscribed: z.boolean().optional(),
          }),
        )
        .max(1000),
    },
    wrap(log, "import_contacts", ({ listId, contacts }) =>
      client.bulkAddContacts(listId, contacts as Contact[]),
    ),
  );

  server.tool(
    "create_campaign",
    "Cria uma campanha em RASCUNHO (não envia). Fonte do conteúdo: templateId (template salvo), OU content (JSON do editor), OU html. Se faltar link de descadastro, um rodapé é adicionado automaticamente. Envio é feito depois por send_campaign/schedule_campaign.",
    {
      name: z.string(),
      from: z.string().describe("Ex.: 'Loja X <news@dominio.com>'"),
      subject: z.string().optional().describe("Se omitido e usar templateId, herda o assunto do template."),
      listId: z.string().describe("ID da lista (contactBookId)"),
      templateId: z.string().optional().describe("Usa um template salvo como conteúdo."),
      html: z.string().optional(),
      content: z.string().optional().describe("JSON do editor (TipTap), alternativa ao html"),
      previewText: z.string().optional(),
      replyTo: z.string().optional(),
    },
    wrap(log, "create_campaign", async ({ listId, templateId, ...rest }) => {
      let { html, content, subject } = rest as {
        html?: string;
        content?: string;
        subject?: string;
      };

      // Resolve template salvo, se informado.
      if (templateId) {
        const t: any = await client.getTemplate(templateId);
        content = content ?? t?.content ?? undefined;
        html = html ?? (t?.content ? undefined : t?.html ?? undefined);
        subject = subject ?? t?.subject;
      }

      // useSend exige o placeholder de descadastro (no html OU no content). Injeta se faltar.
      const UNSUB = /\{\{\s*usesend_unsubscribe_url\s*\}\}/i;
      if (html && !UNSUB.test(html)) {
        html +=
          '\n<p style="font-size:12px;color:#888;text-align:center;margin-top:24px">' +
          'Não quer mais receber? <a href="{{usesend_unsubscribe_url}}">Descadastrar</a>.' +
          "</p>";
      }
      if (content && !UNSUB.test(content)) {
        try {
          const doc = JSON.parse(content);
          if (Array.isArray(doc.content)) {
            doc.content.push({
              type: "paragraph",
              attrs: { textAlign: "center" },
              content: [
                { type: "text", text: "Não quer mais receber? " },
                {
                  type: "text",
                  text: "Descadastrar",
                  marks: [{ type: "link", attrs: { href: "{{usesend_unsubscribe_url}}" } }],
                },
              ],
            });
            content = JSON.stringify(doc);
          }
        } catch {
          /* se não for JSON válido, deixa o useSend validar */
        }
      }

      return client.createCampaign({
        name: rest.name,
        from: rest.from,
        subject,
        previewText: rest.previewText,
        replyTo: rest.replyTo,
        contactBookId: listId,
        ...(content ? { content } : {}),
        ...(html ? { html } : {}),
      });
    }),
  );

  // ============ SEGMENTOS ============
  server.tool(
    "list_segments",
    "Lista os segmentos salvos do cliente.",
    {},
    wrap(log, "list_segments", () => client.listSegments()),
  );

  server.tool(
    "create_segment",
    "Cria um segmento (filtro salvo de contatos). Regras operam sobre: email, firstName, lastName, subscribed, ou properties.<chave>. Ops: eq, neq, contains, in. match: 'all' (E) ou 'any' (OU).",
    {
      name: z.string(),
      contactBookId: z
        .string()
        .optional()
        .describe("Escopar a uma lista; se omitido, vale p/ todos os contatos do time."),
      rules: z
        .object({
          match: z.enum(["all", "any"]).optional(),
          conditions: z.array(
            z.object({
              field: z.string().describe("ex.: 'properties.cidade' ou 'subscribed'"),
              op: z.enum(["eq", "neq", "contains", "in"]),
              value: z.any().optional(),
            }),
          ),
        })
        .describe("Regras do segmento"),
    },
    wrap(log, "create_segment", (input) => client.createSegment(input)),
  );

  server.tool(
    "preview_segment",
    "Prévia de um segmento: quantidade de contatos que casam + amostra. NÃO envia nada.",
    { segmentId: z.string() },
    wrap(log, "preview_segment", ({ segmentId }) =>
      client.previewSegment(segmentId),
    ),
  );

  server.tool(
    "materialize_segment",
    "Cria uma NOVA lista (contact book) com os contatos que casam o segmento. Retorna listId — use em create_campaign para disparar só pro segmento.",
    { segmentId: z.string(), name: z.string().describe("Nome da nova lista") },
    wrap(log, "materialize_segment", ({ segmentId, name }) =>
      client.materializeSegment(segmentId, name),
    ),
  );

  server.tool(
    "delete_segment",
    "Apaga um segmento (não apaga contatos).",
    { segmentId: z.string() },
    wrap(log, "delete_segment", ({ segmentId }) => client.deleteSegment(segmentId)),
  );

  // ============ 🔴 ENVIA P/ GENTE REAL (exige confirm:true) ============
  server.tool(
    "send_campaign",
    "DISPARA uma campanha JÁ CRIADA agora. Requer confirm:true. Sem confirm, retorna um resumo para conferência.",
    { campaignId: z.string(), confirm: z.boolean().default(false) },
    async ({ campaignId, confirm }) => {
      try {
        const c: any = await client.getCampaign(campaignId);
        if (!confirm) {
          log("send_campaign", { campaignId, confirm }, "ok");
          return ok({
            acao: "CONFIRMACAO_NECESSARIA",
            resumo: {
              campanha: c?.name,
              assunto: c?.subject,
              de: c?.from,
              destinatarios: c?.total,
              status: c?.status,
            },
            instrucao:
              "Confira e chame send_campaign de novo com confirm:true para disparar.",
          });
        }
        const r = await client.scheduleCampaign(campaignId, new Date().toISOString());
        log("send_campaign", { campaignId, confirm }, "ok");
        return ok({ enviado: true, destinatarios: Number(c?.total) || 0, resultado: r });
      } catch (e) {
        log("send_campaign", { campaignId, confirm }, "error");
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.tool(
    "schedule_campaign",
    "AGENDA o disparo de uma campanha. 'when' aceita ISO 8601 ou linguagem natural ('amanhã 9h'). Requer confirm:true.",
    { campaignId: z.string(), when: z.string(), confirm: z.boolean().default(false) },
    async ({ campaignId, when, confirm }) => {
      try {
        const c: any = await client.getCampaign(campaignId);
        if (!confirm) {
          log("schedule_campaign", { campaignId, when, confirm }, "ok");
          return ok({
            acao: "CONFIRMACAO_NECESSARIA",
            resumo: { campanha: c?.name, assunto: c?.subject, de: c?.from, destinatarios: c?.total, quando: when },
            instrucao: "Chame de novo com confirm:true para agendar.",
          });
        }
        const r = await client.scheduleCampaign(campaignId, when);
        log("schedule_campaign", { campaignId, when, confirm }, "ok");
        return ok({ agendado: true, destinatarios: Number(c?.total) || 0, resultado: r });
      } catch (e) {
        log("schedule_campaign", { campaignId, when, confirm }, "error");
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.tool(
    "send_email",
    "Envia um e-mail transacional avulso. Requer confirm:true. Aceita html ou templateId.",
    {
      to: z.union([z.string(), z.array(z.string())]),
      from: z.string(),
      subject: z.string().optional(),
      html: z.string().optional(),
      text: z.string().optional(),
      templateId: z.string().optional(),
      replyTo: z.string().optional(),
      confirm: z.boolean().default(false),
    },
    async ({ confirm, ...payload }) => {
      try {
        if (!confirm) {
          log("send_email", { ...payload, confirm }, "ok");
          return ok({
            acao: "CONFIRMACAO_NECESSARIA",
            resumo: { para: payload.to, de: payload.from, assunto: payload.subject },
            instrucao: "Chame send_email de novo com confirm:true para enviar.",
          });
        }
        const r = await client.sendEmail(payload);
        log("send_email", { ...payload, confirm }, "ok");
        return ok({ enviado: true, resultado: r });
      } catch (e) {
        log("send_email", { ...payload, confirm }, "error");
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
