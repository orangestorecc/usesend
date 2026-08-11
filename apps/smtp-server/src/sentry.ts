/**
 * Sentry no gateway SMTP.
 *
 * Este processo é o mais cego dos três: só tem `console.log`, roda solto e,
 * quando cai, o cliente vê o SMTP recusar sem que ninguém seja avisado.
 *
 * É um pacote separado do `web`, então o scrub de PII é reimplementado aqui em
 * versão mínima em vez de importado — o custo de duplicar ~20 linhas é menor
 * que o de criar acoplamento entre os dois apps por causa de telemetria.
 */
import * as Sentry from "@sentry/node";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** `rafael@n49.com.br` vira `[email:n49.com.br]`. */
function mascararEmails(texto: string): string {
  return texto.replace(EMAIL_REGEX, (endereco) => {
    const dominio = endereco.split("@")[1] ?? "desconhecido";
    return `[email:${dominio}]`;
  });
}

function limpar(valor: unknown, profundidade = 0): unknown {
  if (valor == null) return valor;
  if (typeof valor === "string") return mascararEmails(valor);
  if (typeof valor !== "object") return valor;
  if (profundidade >= 5) return "[profundo demais]";
  if (Array.isArray(valor)) {
    return valor.slice(0, 20).map((item) => limpar(item, profundidade + 1));
  }
  const saida: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    // O corpo do email e os anexos nunca saem daqui.
    if (/html|text|content|body|subject|attachment|password|token|key/i.test(chave)) {
      saida[chave] = "[redacted]";
      continue;
    }
    saida[chave] = limpar(item, profundidade + 1);
  }
  return saida;
}

let dsn: string | undefined;

/**
 * Chamada explícita (e não init no topo do módulo) porque o `SENTRY_DSN` só
 * existe depois de `dotenv.config()` rodar no `server.ts`, e imports são
 * içados para antes disso.
 */
export function iniciarSentry() {
  dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    release: process.env.GIT_SHA,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    maxValueLength: 2000,
    // O console daqui imprime endereço de remetente e destinatário o tempo
    // todo; capturá-lo automaticamente seria vazar exatamente o que o scrub
    // existe para evitar.
    integrations: (padrao) => padrao.filter((i) => i.name !== "Console"),
    beforeSend: (evento) => limpar(evento) as typeof evento,
    beforeBreadcrumb: (breadcrumb) => limpar(breadcrumb) as typeof breadcrumb,
  });

  // O SDK do Node não instala handler global por conta própria neste modo, e
  // uma exceção não tratada aqui derruba o gateway SMTP inteiro.
  process.on("uncaughtException", (erro) => {
    reportar(erro, { etapa: "uncaughtException" });
  });
  process.on("unhandledRejection", (motivo) => {
    reportar(motivo, { etapa: "unhandledRejection" });
  });
}

/** Reporta um erro com um rótulo de onde ele veio, sem nunca lançar. */
export function reportar(
  erro: unknown,
  contexto: { etapa: string; [chave: string]: unknown }
) {
  if (!dsn) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTag("etapa", contexto.etapa);
      scope.setContext("smtp", limpar(contexto) as Record<string, unknown>);
      Sentry.captureException(erro);
    });
  } catch {
    // Telemetria não derruba o servidor SMTP.
  }
}

/** Espera o envio pendente antes do processo morrer. */
export async function drenar(timeoutMs = 2000) {
  if (!dsn) return;
  try {
    await Sentry.close(timeoutMs);
  } catch {
    // Ignorado: já estamos no caminho de desligamento.
  }
}
