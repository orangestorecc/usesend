import type { ArquivoAnalisado } from "./parse";
import { analisarLinhas } from "./parse";

/**
 * Leitura de planilha .xlsx.
 *
 * O ExcelJS é pesado, então entra por import dinâmico: quem sobe um .csv nunca
 * chega a baixar essa biblioteca.
 */

/** Célula do Excel vira texto do jeito que a pessoa vê na planilha. */
function celulaParaTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  if (valor instanceof Date) {
    // Data sem hora é o caso comum (aniversário, cadastro). ISO curto evita
    // ambiguidade entre dd/mm e mm/dd.
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    // Fórmula: interessa o resultado, não a fórmula.
    if ("result" in obj) return celulaParaTexto(obj.result);
    // Hiperlink e texto rico.
    if ("text" in obj) return celulaParaTexto(obj.text);
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((p) => celulaParaTexto((p as { text?: unknown }).text))
        .join("");
    }
    if ("hyperlink" in obj) return String(obj.hyperlink);
    return "";
  }

  return String(valor).trim();
}

export async function lerXlsx(
  dados: ArrayBuffer | Buffer,
): Promise<ArquivoAnalisado> {
  const ExcelJS = await import("exceljs");
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(dados as ArrayBuffer);

  const planilha = pasta.worksheets[0];
  if (!planilha) {
    return { cabecalhos: [], linhas: [], separador: ",", semCabecalho: false };
  }

  const matriz: string[][] = [];
  planilha.eachRow({ includeEmpty: false }, (linha) => {
    const valores: string[] = [];
    // `values` do ExcelJS é 1-indexado; a posição 0 vem vazia.
    const brutos = linha.values as unknown[];
    for (let i = 1; i < brutos.length; i++) {
      valores.push(celulaParaTexto(brutos[i]));
    }
    // Linha inteiramente vazia não vira contato nem cabeçalho.
    if (valores.some((v) => v.length > 0)) {
      matriz.push(valores);
    }
  });

  return analisarLinhas(matriz);
}

export function ehPlanilha(nomeArquivo: string): boolean {
  return /\.xlsx$/i.test(nomeArquivo);
}
