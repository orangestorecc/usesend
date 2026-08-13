/**
 * Cirurgia mínima no MIME para encaminhar. Nada é remontado: o corpo original
 * segue byte a byte e só o bloco de cabeçalhos é reescrito, porque remontar a
 * mensagem quebraria anexos, imagens inline e threading.
 *
 * O bloco de cabeçalhos é tratado como latin1 justamente para não corromper
 * bytes de assunto codificado ao converter de volta para Buffer.
 */

const CRLF = "\r\n";

export type PartesMime = { cabecalhos: string; corpo: Buffer };

export function separarMime(raw: Buffer): PartesMime {
  const separadorCrlf = raw.indexOf("\r\n\r\n");
  const separadorLf = raw.indexOf("\n\n");
  const usaCrlf =
    separadorCrlf !== -1 && (separadorLf === -1 || separadorCrlf <= separadorLf);
  const inicio = usaCrlf ? separadorCrlf : separadorLf;

  if (inicio === -1) {
    return { cabecalhos: raw.toString("latin1"), corpo: Buffer.alloc(0) };
  }

  return {
    cabecalhos: raw.subarray(0, inicio).toString("latin1"),
    corpo: raw.subarray(inicio + (usaCrlf ? 4 : 2)),
  };
}

/** Linhas lógicas: continuação (começa com espaço/tab) gruda na anterior. */
function linhasLogicas(cabecalhos: string): string[] {
  const linhas: string[] = [];
  for (const linha of cabecalhos.split(/\r?\n/)) {
    if (/^[ \t]/.test(linha) && linhas.length > 0) {
      linhas[linhas.length - 1] += CRLF + linha;
    } else {
      linhas.push(linha);
    }
  }
  return linhas.filter((l) => l.length > 0);
}

function nomeDoHeader(linhaLogica: string): string {
  return (linhaLogica.split(":")[0] ?? "").trim().toLowerCase();
}

export function lerHeader(
  cabecalhos: string,
  nome: string,
): string | undefined {
  const alvo = nome.toLowerCase();
  for (const linha of linhasLogicas(cabecalhos)) {
    if (nomeDoHeader(linha) === alvo) {
      return linha.slice(linha.indexOf(":") + 1).replace(/\r?\n[ \t]+/g, " ").trim();
    }
  }
  return undefined;
}

/** Carimbo anti-loop: se já passou por aqui, não encaminha de novo. */
export const HEADER_ENCAMINHADO = "X-MadMail-Forwarded";
export const HEADER_REGRA = "X-MadMail-Forward-Rule";

/**
 * Motivos para não encaminhar. Tudo aqui é coisa que, encaminhada, vira loop,
 * ruído ou entrega de malware na caixa de outra pessoa.
 */
export function motivoParaDescartar(cabecalhos: string): string | null {
  if (lerHeader(cabecalhos, HEADER_ENCAMINHADO)) {
    return "mensagem já encaminhada pelo Madmail (anti-loop)";
  }

  const spam = lerHeader(cabecalhos, "X-SES-Spam-Verdict");
  if (spam && spam.toUpperCase() !== "PASS") return "veredito de spam do SES";

  const virus = lerHeader(cabecalhos, "X-SES-Virus-Verdict");
  if (virus && virus.toUpperCase() !== "PASS") return "veredito de vírus do SES";

  const autoSubmitted = lerHeader(cabecalhos, "Auto-Submitted");
  if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") {
    return "mensagem automática (Auto-Submitted)";
  }

  const returnPath = lerHeader(cabecalhos, "Return-Path");
  if (returnPath && /^<\s*>$/.test(returnPath)) {
    return "bounce (Return-Path vazio)";
  }

  const precedence = lerHeader(cabecalhos, "Precedence");
  if (precedence && /^(bulk|list|junk)$/i.test(precedence.trim())) {
    return `Precedence: ${precedence.trim()}`;
  }

  if (lerHeader(cabecalhos, "List-Unsubscribe")) {
    return "mensagem de lista (List-Unsubscribe)";
  }

  return null;
}

const HEADERS_REMOVIDOS = new Set([
  "from",
  "sender",
  "reply-to",
  "return-path",
  "dkim-signature",
  "domainkey-signature",
  "arc-seal",
  "arc-message-signature",
  "arc-authentication-results",
  "bcc",
  HEADER_ENCAMINHADO.toLowerCase(),
  HEADER_REGRA.toLowerCase(),
]);

/**
 * Escapa o nome exibido no From. O endereço é sempre nosso; só o nome vem da
 * mensagem original, e ele não pode injetar aspas nem quebra de linha no
 * cabeçalho.
 */
function nomeSeguro(nome: string): string {
  return nome.replace(/[\r\n"\\]/g, " ").trim().slice(0, 120);
}

/**
 * Reescreve o From para um endereço do domínio do cliente (que tem DKIM aqui)
 * e joga o remetente original no Reply-To — responder no destino volta para
 * quem escreveu, não para o Madmail. É o mesmo desenho de SRS usado por
 * Cloudflare e ImprovMX.
 */
export function reescreverParaEncaminhamento({
  raw,
  remetenteEnvelope,
  nomeOriginal,
  emailOriginal,
  ruleId,
}: {
  raw: Buffer;
  remetenteEnvelope: string;
  nomeOriginal?: string | null;
  emailOriginal: string;
  ruleId: string;
}): Buffer {
  const { cabecalhos, corpo } = separarMime(raw);

  const mantidos = linhasLogicas(cabecalhos).filter(
    (linha) => !HEADERS_REMOVIDOS.has(nomeDoHeader(linha)),
  );

  const rotulo = nomeSeguro(
    nomeOriginal ? `${nomeOriginal} (via ${emailOriginal})` : emailOriginal,
  );

  const novos = [
    `From: "${rotulo}" <${remetenteEnvelope}>`,
    `Reply-To: <${emailOriginal}>`,
    `${HEADER_ENCAMINHADO}: 1`,
    `${HEADER_REGRA}: ${ruleId}`,
  ];

  const bloco = [...novos, ...mantidos].join(CRLF);
  return Buffer.concat([
    Buffer.from(bloco + CRLF + CRLF, "latin1"),
    corpo,
  ]);
}
