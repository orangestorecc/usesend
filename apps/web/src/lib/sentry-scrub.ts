/**
 * Remoção de PII antes de qualquer coisa sair para o Sentry.
 *
 * O produto é uma plataforma de email: praticamente todo objeto que circula
 * carrega endereço de destinatário, nome de contato ou corpo de mensagem.
 * Nada disso pode virar telemetria de terceiro, então o filtro roda em cima do
 * evento inteiro (mensagem, breadcrumbs, extras, contexto de request) e não
 * apenas em campos conhecidos.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Chaves cujo valor é removido por inteiro, independente do formato. Batem por
 * substring em minúsculas, então `apiKey`, `x-api-key` e `API_KEY` caem todas
 * na mesma regra.
 */
const CHAVES_SENSIVEIS = [
  "password",
  "senha",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "accesskey",
  "secretkey",
  "creditcard",
  "cardnumber",
  "cvv",
  "cpf",
  "cnpj",
  "html",
  "text",
  "content",
  "body",
  "subject",
  "attachments",
];

/**
 * Chaves de destinatário: em vez de apagar, guardamos só o domínio. Saber que
 * a falha foi em envios para `@gmail.com` ajuda a diagnosticar; o endereço
 * completo não acrescenta nada.
 */
const CHAVES_EMAIL = ["to", "from", "cc", "bcc", "replyto", "reply_to", "email", "recipient", "sender"];

const PROFUNDIDADE_MAXIMA = 6;

const REDACTED = "[redacted]";

function bate(chave: string, lista: string[]): boolean {
  const normalizada = chave.toLowerCase().replace(/[-_\s]/g, "");
  return lista.some((termo) => normalizada.includes(termo.replace(/[-_]/g, "")));
}

/** `rafael@n49.com.br` vira `[email:n49.com.br]`. */
export function mascararEmails(texto: string): string {
  return texto.replace(EMAIL_REGEX, (endereco) => {
    const dominio = endereco.split("@")[1] ?? "desconhecido";
    return `[email:${dominio}]`;
  });
}

function limparValor(valor: unknown, profundidade: number): unknown {
  if (valor == null) return valor;

  if (typeof valor === "string") return mascararEmails(valor);

  if (typeof valor !== "object") return valor;

  if (profundidade >= PROFUNDIDADE_MAXIMA) return "[profundo demais]";

  if (Array.isArray(valor)) {
    // Arrays grandes normalmente são listas de destinatários; o tamanho já diz
    // o que precisamos saber e evita evento de centenas de KB.
    if (valor.length > 20) return `[${valor.length} itens]`;
    return valor.map((item) => limparValor(item, profundidade + 1));
  }

  const saida: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    if (bate(chave, CHAVES_SENSIVEIS)) {
      saida[chave] = REDACTED;
      continue;
    }
    if (bate(chave, CHAVES_EMAIL)) {
      saida[chave] =
        typeof item === "string" ? mascararEmails(item) : limparValor(item, profundidade + 1);
      continue;
    }
    saida[chave] = limparValor(item, profundidade + 1);
  }
  return saida;
}

/** Ponto de entrada usado pelos `beforeSend` / `beforeSendTransaction`. */
export function limparEvento<T extends Record<string, any>>(evento: T): T {
  return limparValor(evento, 0) as T;
}

/**
 * Erros que não representam defeito e só gastariam cota: navegação cancelada,
 * extensão de browser, rede caindo do lado do usuário.
 */
export const ERROS_IGNORADOS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
  "NEXT_NOT_FOUND",
  "NEXT_REDIRECT",
  "AbortError",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
  "Load failed",
  /^Loading chunk \d+ failed/,
  /extension\//i,
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
];
