import { describe, expect, it } from "vitest";
import {
  HEADER_ENCAMINHADO,
  HEADER_REGRA,
  lerHeader,
  motivoParaDescartar,
  reescreverParaEncaminhamento,
  separarMime,
} from "./mime-forward";

function mime(headers: string[], corpo = "Oi, tudo bem?") {
  return Buffer.from(headers.join("\r\n") + "\r\n\r\n" + corpo, "latin1");
}

const BASE = [
  "Return-Path: <cliente@exemplo.com>",
  "Received: by mail.madmail.com.br with SMTP for <contato@empresa.com.br>",
  "From: Cliente <cliente@exemplo.com>",
  "To: contato@empresa.com.br",
  "Subject: Pedido 123",
  "X-SES-Spam-Verdict: PASS",
  "X-SES-Virus-Verdict: PASS",
  "Content-Type: text/plain; charset=utf-8",
];

describe("separarMime", () => {
  it("separa cabeçalhos do corpo preservando o corpo byte a byte", () => {
    const { cabecalhos, corpo } = separarMime(mime(BASE, "linha1\r\nlinha2"));
    expect(cabecalhos).toContain("Subject: Pedido 123");
    expect(corpo.toString("latin1")).toBe("linha1\r\nlinha2");
  });

  it("entende cabeçalho dobrado em várias linhas", () => {
    const raw = mime([
      "Subject: assunto",
      "To: um@exemplo.com,",
      "\tdois@exemplo.com",
    ]);
    expect(lerHeader(separarMime(raw).cabecalhos, "to")).toBe(
      "um@exemplo.com, dois@exemplo.com",
    );
  });
});

describe("motivoParaDescartar", () => {
  it("deixa passar mensagem normal", () => {
    expect(motivoParaDescartar(separarMime(mime(BASE)).cabecalhos)).toBeNull();
  });

  it.each([
    ["X-SES-Spam-Verdict: FAIL", "spam"],
    ["X-SES-Virus-Verdict: FAIL", "vírus"],
    ["Auto-Submitted: auto-replied", "automática"],
    ["Precedence: bulk", "Precedence"],
    ["List-Unsubscribe: <mailto:sair@x.com>", "lista"],
    [`${HEADER_ENCAMINHADO}: 1`, "anti-loop"],
  ])("descarta por %s", (header, trecho) => {
    const cabecalhos = separarMime(
      mime([...BASE.filter((h) => !h.startsWith(header.split(":")[0]!)), header]),
    ).cabecalhos;
    expect(motivoParaDescartar(cabecalhos)).toContain(trecho);
  });

  it("descarta bounce com Return-Path vazio", () => {
    const cabecalhos = separarMime(
      mime([...BASE.filter((h) => !h.startsWith("Return-Path")), "Return-Path: <>"]),
    ).cabecalhos;
    expect(motivoParaDescartar(cabecalhos)).toContain("bounce");
  });
});

describe("reescreverParaEncaminhamento", () => {
  const reescrito = reescreverParaEncaminhamento({
    raw: mime(BASE),
    remetenteEnvelope: "encaminhamento@empresa.com.br",
    nomeOriginal: "Cliente",
    emailOriginal: "cliente@exemplo.com",
    ruleId: "regra_1",
  });
  const cabecalhos = separarMime(reescrito).cabecalhos;

  it("assina como domínio do cliente e devolve a resposta ao remetente original", () => {
    expect(lerHeader(cabecalhos, "from")).toBe(
      '"Cliente (via cliente@exemplo.com)" <encaminhamento@empresa.com.br>',
    );
    expect(lerHeader(cabecalhos, "reply-to")).toBe("<cliente@exemplo.com>");
  });

  it("carimba anti-loop e a regra de origem", () => {
    expect(lerHeader(cabecalhos, HEADER_ENCAMINHADO)).toBe("1");
    expect(lerHeader(cabecalhos, HEADER_REGRA)).toBe("regra_1");
  });

  it("remove assinatura e envelope antigos que não valem mais", () => {
    const comDkim = reescreverParaEncaminhamento({
      raw: mime([...BASE, "DKIM-Signature: v=1; d=exemplo.com; b=abc"]),
      remetenteEnvelope: "encaminhamento@empresa.com.br",
      emailOriginal: "cliente@exemplo.com",
      ruleId: "regra_1",
    });
    const h = separarMime(comDkim).cabecalhos;
    expect(lerHeader(h, "dkim-signature")).toBeUndefined();
    expect(lerHeader(h, "return-path")).toBeUndefined();
  });

  it("mantém assunto e corpo intactos", () => {
    expect(lerHeader(cabecalhos, "subject")).toBe("Pedido 123");
    expect(separarMime(reescrito).corpo.toString("latin1")).toBe(
      "Oi, tudo bem?",
    );
  });

  it("não deixa o nome do remetente injetar cabeçalho", () => {
    const malicioso = reescreverParaEncaminhamento({
      raw: mime(BASE),
      remetenteEnvelope: "encaminhamento@empresa.com.br",
      nomeOriginal: 'Fulano"\r\nBcc: vitima@exemplo.com',
      emailOriginal: "cliente@exemplo.com",
      ruleId: "regra_1",
    });
    const h = separarMime(malicioso).cabecalhos;
    expect(lerHeader(h, "bcc")).toBeUndefined();
    expect(h.split(/\r?\n/)[0]).toContain("encaminhamento@empresa.com.br");
  });
});
