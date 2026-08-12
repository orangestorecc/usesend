import { getCanonicalContactVariableName } from "~/lib/contact-properties";

/**
 * Parse e mapeamento do arquivo de importação de contatos.
 *
 * Estas funções são puras de propósito: a tela usa para a pré-visualização e o
 * servidor usa para a importação de verdade. Se cada lado tivesse o seu
 * parser, o que a pessoa vê na prévia poderia não ser o que entra na lista.
 */

/** Para onde cada coluna do arquivo vai. `prop:<nome>` vira propriedade. */
export type DestinoColuna =
  | "email"
  | "firstName"
  | "lastName"
  | "subscribed"
  | "ignore"
  | `prop:${string}`;

export type Mapeamento = Record<string, DestinoColuna>;

export type LinhaAnalisada = {
  email: string;
  firstName?: string;
  lastName?: string;
  subscribed?: boolean;
  properties?: Record<string, string>;
  /** Motivo de descarte, quando houver. */
  problema?: "email-invalido" | "email-vazio" | "duplicado";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(valor: string): boolean {
  return EMAIL_RE.test(valor);
}

/**
 * Divide uma linha de CSV respeitando aspas e aspas escapadas (`""`).
 * Aceita vírgula ou ponto e vírgula — Excel em português salva com `;`.
 */
export function dividirLinha(linha: string, separador: string): string[] {
  const partes: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (c === separador && !dentroDeAspas) {
      partes.push(atual.trim());
      atual = "";
    } else {
      atual += c;
    }
  }
  partes.push(atual.trim());
  return partes;
}

/** Chuta o separador pela primeira linha: vence quem aparece mais. */
export function detectarSeparador(primeiraLinha: string): string {
  const virgulas = (primeiraLinha.match(/,/g) ?? []).length;
  const pontoEVirgulas = (primeiraLinha.match(/;/g) ?? []).length;
  const tabs = (primeiraLinha.match(/\t/g) ?? []).length;
  if (tabs > virgulas && tabs > pontoEVirgulas) return "\t";
  return pontoEVirgulas > virgulas ? ";" : ",";
}

export type ArquivoAnalisado = {
  cabecalhos: string[];
  linhas: string[][];
  separador: string;
  /** true quando a 1ª linha era dado, não cabeçalho. */
  semCabecalho: boolean;
};

export function analisarArquivo(texto: string): ArquivoAnalisado {
  // Excel grava BOM no UTF-8; sem remover, o 1º cabeçalho vem sujo.
  const limpo = texto.replace(/^﻿/, "");
  const linhasBrutas = limpo
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (linhasBrutas.length === 0) {
    return { cabecalhos: [], linhas: [], separador: ",", semCabecalho: false };
  }

  const separador = detectarSeparador(linhasBrutas[0]!);
  const primeira = dividirLinha(linhasBrutas[0]!, separador).map((c) =>
    c.replace(/^"|"$/g, ""),
  );

  // Se a primeira linha já tem e-mail de verdade, ela é dado e não cabeçalho.
  const semCabecalho = primeira.some((c) => emailValido(c));

  const cabecalhos = semCabecalho
    ? primeira.map((_, i) => `Coluna ${i + 1}`)
    : primeira;

  const corpo = (semCabecalho ? linhasBrutas : linhasBrutas.slice(1)).map((l) =>
    dividirLinha(l, separador),
  );

  return { cabecalhos, linhas: corpo, separador, semCabecalho };
}

const APELIDOS_EMAIL = [
  "email",
  "e-mail",
  "email address",
  "endereco de email",
  "endereço de e-mail",
  "e_mail",
  "mail",
];
const APELIDOS_NOME = ["firstname", "first name", "nome", "primeiro nome"];
const APELIDOS_SOBRENOME = [
  "lastname",
  "last name",
  "sobrenome",
  "ultimo nome",
  "último nome",
];
const APELIDOS_INSCRITO = [
  "subscribed",
  "inscrito",
  "newsletter",
  "aceita email",
  "aceita e-mail",
];

function normalizar(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Chute inicial do DE-PARA. O resultado é só o valor inicial dos seletores na
 * tela — quem decide é a pessoa. Antes disso o mapeamento acontecia escondido,
 * e quem tinha uma coluna com nome fora do padrão não descobria.
 */
export function mapearAutomaticamente(
  cabecalhos: string[],
  variaveisDaLista: string[] = [],
): Mapeamento {
  const mapa: Mapeamento = {};
  let jaTemEmail = false;

  for (const cabecalho of cabecalhos) {
    const n = normalizar(cabecalho);

    if (!jaTemEmail && APELIDOS_EMAIL.includes(n)) {
      mapa[cabecalho] = "email";
      jaTemEmail = true;
      continue;
    }
    if (APELIDOS_NOME.includes(n)) {
      mapa[cabecalho] = "firstName";
      continue;
    }
    if (APELIDOS_SOBRENOME.includes(n)) {
      mapa[cabecalho] = "lastName";
      continue;
    }
    if (APELIDOS_INSCRITO.includes(n)) {
      mapa[cabecalho] = "subscribed";
      continue;
    }

    const canonico =
      getCanonicalContactVariableName(cabecalho.trim(), variaveisDaLista) ??
      cabecalho.trim();
    mapa[cabecalho] = `prop:${canonico}`;
  }

  // Nenhuma coluna com cara de e-mail: tenta pelo conteúdo mais adiante, mas
  // deixa tudo como propriedade para a pessoa escolher na tela.
  return mapa;
}

function interpretarInscrito(valor: string): boolean | undefined {
  const v = normalizar(valor);
  if (["yes", "true", "sim", "1", "s"].includes(v)) return true;
  if (["no", "false", "nao", "0", "n"].includes(v)) return false;
  return undefined;
}

export type ResultadoMapeamento = {
  contatos: LinhaAnalisada[];
  validos: number;
  invalidos: number;
  duplicados: number;
};

/** Aplica o DE-PARA nas linhas e deduplica por e-mail (primeira ocorrência vence). */
export function aplicarMapeamento(
  arquivo: ArquivoAnalisado,
  mapeamento: Mapeamento,
): ResultadoMapeamento {
  const indiceDe = (destino: DestinoColuna) =>
    arquivo.cabecalhos.findIndex((c) => mapeamento[c] === destino);

  const iEmail = indiceDe("email");
  const iNome = indiceDe("firstName");
  const iSobrenome = indiceDe("lastName");
  const iInscrito = indiceDe("subscribed");

  const vistos = new Set<string>();
  const contatos: LinhaAnalisada[] = [];
  let validos = 0;
  let invalidos = 0;
  let duplicados = 0;

  for (const linha of arquivo.linhas) {
    const bruto = iEmail >= 0 ? (linha[iEmail] ?? "") : "";
    const email = bruto.trim().toLowerCase().replace(/^"|"$/g, "");

    if (!email) {
      invalidos++;
      contatos.push({ email: "", problema: "email-vazio" });
      continue;
    }
    if (!emailValido(email)) {
      invalidos++;
      contatos.push({ email, problema: "email-invalido" });
      continue;
    }
    if (vistos.has(email)) {
      duplicados++;
      contatos.push({ email, problema: "duplicado" });
      continue;
    }
    vistos.add(email);

    const properties: Record<string, string> = {};
    arquivo.cabecalhos.forEach((cabecalho, i) => {
      const destino = mapeamento[cabecalho];
      if (!destino || !destino.startsWith("prop:")) return;
      const valor = linha[i]?.trim();
      if (valor) properties[destino.slice(5)] = valor;
    });

    contatos.push({
      email,
      firstName: iNome >= 0 ? linha[iNome]?.trim() || undefined : undefined,
      lastName:
        iSobrenome >= 0 ? linha[iSobrenome]?.trim() || undefined : undefined,
      subscribed:
        iInscrito >= 0
          ? interpretarInscrito(linha[iInscrito] ?? "")
          : undefined,
      properties: Object.keys(properties).length ? properties : undefined,
    });
    validos++;
  }

  return { contatos, validos, invalidos, duplicados };
}

/** Cabeçalhos do modelo oferecido para download. */
export const COLUNAS_MODELO = [
  "email",
  "nome",
  "sobrenome",
  "inscrito",
  "cidade",
] as const;

export const LINHAS_MODELO = [
  ["maria.silva@exemplo.com.br", "Maria", "Silva", "sim", "Recife"],
  ["joao.souza@exemplo.com.br", "João", "Souza", "sim", "São Paulo"],
  ["ana.lima@exemplo.com.br", "Ana", "Lima", "nao", "Curitiba"],
];
