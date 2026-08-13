import type { JSONContent } from "@tiptap/core";

/**
 * Nós que não contam como conteúdo: o parágrafo vazio que o TipTap autosalva
 * assim que o editor monta não pode fazer a oferta de template sumir.
 */
const NOS_NEUTROS = new Set(["doc", "paragraph"]);

/**
 * Documento vazio: nenhum texto não-branco e nenhum nó além de `doc`/`paragraph`.
 * Um `spacer` ou uma imagem sozinha já são conteúdo, mesmo sem texto algum.
 *
 * Função pura de propósito — é ela que decide se o overlay de templates
 * aparece, e um critério errado ou apaga a oferta cedo demais ou a mostra por
 * cima de um e-mail já montado.
 */
export function isDocEmpty(doc: JSONContent | null | undefined): boolean {
  if (!doc) return true;
  if (doc.type === "text" || typeof doc.text === "string") {
    return (doc.text ?? "").trim() === "";
  }
  if (doc.type && !NOS_NEUTROS.has(doc.type)) return false;
  const filhos = doc.content ?? [];
  return filhos.every((filho) => isDocEmpty(filho));
}
