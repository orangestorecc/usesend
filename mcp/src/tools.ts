import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UseSendClient, type Contact, type McpScopes, type ScopeLevel } from "./usesend.js";
import { summarizeBilling } from "./billing.js";

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

const canRead = (lvl: ScopeLevel | "none" | "read") =>
  lvl === "read" || lvl === "write";
const canWrite = (lvl: ScopeLevel) => lvl === "write";

export function registerTools(
  server: McpServer,
  client: UseSendClient,
  log: LogFn,
  scopes: McpScopes,
) {
  // Só registra a ferramenta se o escopo permitir.
  const reg = (
    allowed: boolean,
    name: string,
    desc: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: any) => Promise<any> | any,
  ) => {
    if (allowed) server.tool(name, desc, schema, handler);
  };

  // ============ Consumo/cobrança (sempre disponível) ============
  reg(
    true,
    "get_usage",
    "Consumo da conta: total de contatos e, quando a integração tem um plano por contato configurado, o custo mensal estimado. NÃO é a fatura oficial — para valores de cobrança, mande o cliente conferir no painel.",
    {},
    wrap(log, "get_usage", async () =>
      summarizeBilling(scopes.plan, await client.countContacts()),
    ),
  );

  // ============ 🟢 LEITURA ============
  // Sempre disponível: sem saber de quais domínios o time pode enviar, o agente
  // chuta o `from` de create_campaign/send_email e o envio é recusado.
  reg(
    true,
    "list_domains",
    "Lista os domínios de envio do time e o status de verificação de cada um. CHAME ANTES de montar o campo 'from' de uma campanha ou e-mail: só domínios verificados podem enviar.",
    {},
    wrap(log, "list_domains", () => client.listDomains()),
  );

  reg(
    true,
    "get_domain",
    "Detalhes de um domínio, incluindo os registros DNS (SPF/DKIM) e o que ainda falta para verificar.",
    { domainId: z.number().int().describe("ID numérico do domínio") },
    wrap(log, "get_domain", ({ domainId }) => client.getDomain(domainId)),
  );

  reg(
    canRead(scopes.lists),
    "list_lists",
    "Lista as listas de contatos (contact books) do cliente.",
    {},
    wrap(log, "list_lists", () => client.listContactBooks()),
  );

  reg(
    canRead(scopes.contacts),
    "list_contacts",
    "Lista os contatos de uma lista.",
    { listId: z.string().describe("ID da lista (contact book)") },
    wrap(log, "list_contacts", ({ listId }) => client.listContacts(listId)),
  );

  reg(
    canRead(scopes.campaigns),
    "list_campaigns",
    "Lista as campanhas do cliente.",
    {},
    wrap(log, "list_campaigns", () => client.listCampaigns()),
  );

  reg(
    canRead(scopes.campaigns),
    "get_campaign_report",
    "Relatório de uma campanha: enviados, entregues, abertos, cliques, bounces.",
    { campaignId: z.string() },
    wrap(log, "get_campaign_report", ({ campaignId }) =>
      client.getCampaign(campaignId),
    ),
  );

  reg(
    scopes.analytics === "read",
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

  reg(
    scopes.reputation === "read",
    "get_reputation_status",
    "Saúde de entregabilidade da conta: estado atual, taxa de devolução (bounce) e de reclamação. Use para responder 'minha conta está saudável?' e antes de disparos grandes.",
    {},
    wrap(log, "get_reputation_status", () => client.reputationStatus()),
  );

  reg(
    scopes.reputation === "read",
    "get_bounce_breakdown",
    "Quais domínios e motivos estão puxando a devolução para baixo — os principais ofensores.",
    {},
    wrap(log, "get_bounce_breakdown", () => client.bounceBreakdown()),
  );

  reg(
    canRead(scopes.templates),
    "list_templates",
    "Lista os templates de e-mail do cliente.",
    {},
    wrap(log, "list_templates", () => client.listTemplates()),
  );

  reg(
    canRead(scopes.templates),
    "get_template",
    "Retorna um template (inclui content JSON e html renderizado).",
    { templateId: z.string() },
    wrap(log, "get_template", ({ templateId }) => client.getTemplate(templateId)),
  );

  reg(
    canRead(scopes.templates),
    "render_preview",
    "Renderiza um JSON do editor (TipTap) para HTML, SEM salvar. Use para pré-visualizar o e-mail que a IA montou antes de salvar/enviar.",
    { content: z.string().describe("JSON do editor (TipTap)") },
    wrap(log, "render_preview", ({ content }) => client.renderTemplate(content)),
  );

  reg(
    canRead(scopes.segments),
    "list_segments",
    "Lista os segmentos salvos do cliente.",
    {},
    wrap(log, "list_segments", () => client.listSegments()),
  );

  reg(
    canRead(scopes.segments),
    "preview_segment",
    "Prévia de um segmento: quantidade de contatos que casam + amostra. NÃO envia nada.",
    { segmentId: z.string() },
    wrap(log, "preview_segment", ({ segmentId }) =>
      client.previewSegment(segmentId),
    ),
  );

  // ============ 🟡 ESCRITA REVERSÍVEL ============
  reg(
    canWrite(scopes.templates),
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

  reg(
    canWrite(scopes.lists),
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

  reg(
    canRead(scopes.contacts),
    "get_contact",
    "Dados de um contato específico: inscrito ou não, propriedades, histórico básico.",
    { listId: z.string(), contactId: z.string() },
    wrap(log, "get_contact", ({ listId, contactId }) =>
      client.getContact(listId, contactId),
    ),
  );

  reg(
    canWrite(scopes.contacts),
    "unsubscribe_contact",
    "DESCADASTRA um contato: ele para de receber campanhas, mas continua na lista. Use quando o cliente pedir para sair pelo WhatsApp, telefone ou e-mail.",
    { listId: z.string(), contactId: z.string() },
    wrap(log, "unsubscribe_contact", ({ listId, contactId }) =>
      client.updateContact(listId, contactId, { subscribed: false }),
    ),
  );

  reg(
    canWrite(scopes.contacts),
    "update_contact",
    "Corrige os dados de um contato (nome, propriedades). Para descadastrar, prefira unsubscribe_contact.",
    {
      listId: z.string(),
      contactId: z.string(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      properties: z.record(z.string()).optional(),
    },
    wrap(log, "update_contact", ({ listId, contactId, ...data }) =>
      client.updateContact(listId, contactId, data),
    ),
  );

  reg(
    canWrite(scopes.contacts),
    "delete_contact",
    "APAGA um contato de vez (pedido de exclusão de dados / LGPD). Não dá para desfazer — confirme com o cliente antes. Se ele só quer parar de receber, use unsubscribe_contact.",
    { listId: z.string(), contactId: z.string() },
    wrap(log, "delete_contact", ({ listId, contactId }) =>
      client.deleteContact(listId, contactId),
    ),
  );

  reg(
    canWrite(scopes.contacts),
    "import_contacts",
    "Adiciona/atualiza contatos em uma lista (em lote, até 1000). ATENÇÃO: se a lista usa confirmação (double opt-in), cada contato novo recebe um e-mail de confirmação de verdade — avise o cliente antes de importar em massa.",
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

  reg(
    canWrite(scopes.campaigns),
    "create_campaign",
    "Cria uma campanha em RASCUNHO (não envia). Fonte do conteúdo: templateId (template salvo), OU content (JSON do editor), OU html. Se faltar link de descadastro, um rodapé é adicionado automaticamente. Envio é feito depois por send_campaign/schedule_campaign.",
    {
      name: z.string(),
      from: z
        .string()
        .describe(
          "Ex.: 'Loja X <news@dominio.com>'. O domínio PRECISA estar verificado — chame list_domains antes se não tiver certeza.",
        ),
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

      if (templateId) {
        const t: any = await client.getTemplate(templateId);
        content = content ?? t?.content ?? undefined;
        html = html ?? (t?.content ? undefined : t?.html ?? undefined);
        subject = subject ?? t?.subject;
      }

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

  reg(
    canWrite(scopes.segments),
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

  reg(
    canWrite(scopes.segments),
    "materialize_segment",
    "Cria uma NOVA lista (contact book) com os contatos que casam o segmento. Retorna listId — use em create_campaign para disparar só pro segmento.",
    { segmentId: z.string(), name: z.string().describe("Nome da nova lista") },
    wrap(log, "materialize_segment", ({ segmentId, name }) =>
      client.materializeSegment(segmentId, name),
    ),
  );

  reg(
    canWrite(scopes.segments),
    "delete_segment",
    "Apaga um segmento (não apaga contatos).",
    { segmentId: z.string() },
    wrap(log, "delete_segment", ({ segmentId }) => client.deleteSegment(segmentId)),
  );

  // Freio de mão: quem pode disparar precisa poder parar.
  reg(
    canWrite(scopes.campaigns),
    "pause_campaign",
    "PAUSA uma campanha que está sendo enviada. Use quando o cliente perceber erro no meio do disparo — os e-mails que ainda não saíram param.",
    { campaignId: z.string() },
    wrap(log, "pause_campaign", ({ campaignId }) =>
      client.pauseCampaign(campaignId),
    ),
  );

  reg(
    scopes.send === true,
    "resume_campaign",
    "RETOMA uma campanha pausada, continuando o envio de onde parou. Requer confirm:true.",
    { campaignId: z.string(), confirm: z.boolean().default(false) },
    async ({ campaignId, confirm }: { campaignId: string; confirm: boolean }) => {
      try {
        const c: any = await client.getCampaign(campaignId);
        if (!confirm) {
          log("resume_campaign", { campaignId, confirm }, "ok");
          return ok({
            acao: "CONFIRMACAO_NECESSARIA",
            resumo: { campanha: c?.name, assunto: c?.subject, status: c?.status },
            instrucao: "Chame de novo com confirm:true para retomar o envio.",
          });
        }
        const r = await client.resumeCampaign(campaignId);
        log("resume_campaign", { campaignId, confirm }, "ok");
        return ok({ retomado: true, resultado: r });
      } catch (e) {
        log("resume_campaign", { campaignId, confirm }, "error");
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  // Diagnóstico de envio avulso: "o e-mail do fulano chegou?"
  reg(
    canRead(scopes.campaigns),
    "get_email",
    "Situação de um e-mail avulso: entregue, aberto, clicado, devolvido (bounce) — com o motivo quando falhou.",
    { emailId: z.string() },
    wrap(log, "get_email", ({ emailId }) => client.getEmail(emailId)),
  );

  reg(
    scopes.send === true,
    "cancel_email",
    "Cancela um e-mail que foi AGENDADO e ainda não saiu.",
    { emailId: z.string() },
    wrap(log, "cancel_email", ({ emailId }) => client.cancelEmail(emailId)),
  );

  // ============ 🔴 ENVIA P/ GENTE REAL (exige confirm:true + escopo de envio) ============
  reg(
    scopes.send === true,
    "send_campaign",
    "DISPARA uma campanha JÁ CRIADA agora. Requer confirm:true. Sem confirm, retorna um resumo para conferência.",
    { campaignId: z.string(), confirm: z.boolean().default(false) },
    async ({ campaignId, confirm }: { campaignId: string; confirm: boolean }) => {
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

  reg(
    scopes.send === true,
    "schedule_campaign",
    "AGENDA o disparo de uma campanha. 'when' aceita ISO 8601 ou linguagem natural ('amanhã 9h'). Requer confirm:true.",
    { campaignId: z.string(), when: z.string(), confirm: z.boolean().default(false) },
    async ({ campaignId, when, confirm }: { campaignId: string; when: string; confirm: boolean }) => {
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

  reg(
    scopes.send === true,
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
    async ({ confirm, ...payload }: any) => {
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
