/**
 * Preço por passo do slider.
 *
 * Base: os planos do Resend com os valores em dólar multiplicados por 5 e
 * expressos em reais. A matriz completa e a razão de cada regra estão em
 * docs-spec/PLANOS-SPEC.md.
 *
 * Tudo aqui é dado puro e função pura — é dinheiro, então precisa ser
 * testável sem montar tela nenhuma.
 */

export * from "./catalogo";

export type PrecoPorPasso = {
  /** Índice do passo do slider a partir do qual este preço passa a valer. */
  aPartirDoPasso: number;
  precoBRL: number;
  volume: string;
  /** Linha pequena embaixo do volume, quando há excedente. */
  extra?: string;
};

export const PASSOS_TRANSACIONAL = [
  "3.000",
  "50.000",
  "100.000",
  "200.000",
  "500.000",
  "1.000.000",
  "1.500.000",
  "2.500.000",
  "3.000.000+",
];

export const PASSOS_MARKETING = [
  "1.000",
  "5.000",
  "10.000",
  "25.000",
  "50.000",
  "100.000",
  "150.000",
  "200.000+",
];

const EXTRA = (valor: string) => `E-mails extras: R$ ${valor} / 1.000`;

/** Pro transacional: cobre até 100 mil e para por aí. */
export const PRECOS_PRO: PrecoPorPasso[] = [
  {
    aPartirDoPasso: 0,
    precoBRL: 100,
    volume: "50.000 e-mails / mês",
    extra: EXTRA("4,50"),
  },
  {
    aPartirDoPasso: 2,
    precoBRL: 175,
    volume: "100.000 e-mails / mês",
    extra: EXTRA("4,50"),
  },
];

/** Scale transacional: começa em 100 mil e vai até 2,5 milhões. */
export const PRECOS_SCALE: PrecoPorPasso[] = [
  {
    aPartirDoPasso: 0,
    precoBRL: 450,
    volume: "100.000 e-mails / mês",
    extra: EXTRA("4,50"),
  },
  {
    aPartirDoPasso: 3,
    precoBRL: 800,
    volume: "200.000 e-mails / mês",
    extra: EXTRA("4,00"),
  },
  {
    aPartirDoPasso: 4,
    precoBRL: 1750,
    volume: "500.000 e-mails / mês",
    extra: EXTRA("3,50"),
  },
  {
    aPartirDoPasso: 5,
    precoBRL: 3250,
    volume: "1.000.000 e-mails / mês",
    extra: EXTRA("3,25"),
  },
  {
    aPartirDoPasso: 6,
    precoBRL: 4125,
    volume: "1.500.000 e-mails / mês",
    extra: EXTRA("2,60"),
  },
  {
    aPartirDoPasso: 7,
    precoBRL: 5750,
    volume: "2.500.000 e-mails / mês",
    extra: EXTRA("2,30"),
  },
];

export const PRECOS_PRO_MARKETING: PrecoPorPasso[] = [
  { aPartirDoPasso: 0, precoBRL: 200, volume: "5.000 contatos" },
  { aPartirDoPasso: 2, precoBRL: 400, volume: "10.000 contatos" },
  { aPartirDoPasso: 3, precoBRL: 900, volume: "25.000 contatos" },
  { aPartirDoPasso: 4, precoBRL: 1250, volume: "50.000 contatos" },
  { aPartirDoPasso: 5, precoBRL: 2250, volume: "100.000 contatos" },
  { aPartirDoPasso: 6, precoBRL: 3250, volume: "150.000 contatos" },
];

export const PRECOS_POR_PLANO: Record<string, PrecoPorPasso[]> = {
  pro: PRECOS_PRO,
  scale: PRECOS_SCALE,
  pro_marketing: PRECOS_PRO_MARKETING,
};

/** Preço vigente de um plano de volume variável no passo escolhido. */
export function precoNoPasso(
  planoKey: string,
  passo: number,
): PrecoPorPasso | null {
  const faixas = PRECOS_POR_PLANO[planoKey];
  if (!faixas) return null;

  let vigente = faixas[0]!;
  for (const faixa of faixas) {
    if (passo >= faixa.aPartirDoPasso) vigente = faixa;
  }
  return vigente;
}

/**
 * Cota mensal inclusa no plano, no passo escolhido.
 *
 * Sai do próprio texto do volume ("50.000 e-mails / mês" → 50000) porque é ele
 * que o cliente leu na hora de assinar: se a cota do excedente viesse de outra
 * tabela, um dia ela discordaria do que a tela prometeu. Retorna null para
 * plano sem faixa variável (Free, Enterprise), que não tem excedente.
 */
export function cotaMensalDoPlano(
  planoKey: string,
  passo: number,
): number | null {
  const faixa = precoNoPasso(planoKey, passo);
  if (!faixa) return null;
  const digitos = faixa.volume.replace(/[^\d.]/g, "").replace(/\./g, "");
  const n = Number(digitos);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Preço do bloco de 1.000 e-mails excedentes do plano, em reais.
 *
 * Lê a mesma linha "E-mails extras: R$ X / 1.000" que aparece no card do
 * /pricing — o excedente cai conforme o volume sobe, e cobrar um valor fixo
 * enquanto a vitrine anuncia outro seria cobrar diferente do combinado.
 */
export function precoExcedenteBRL(
  planoKey: string,
  passo: number,
): number | null {
  const faixa = precoNoPasso(planoKey, passo);
  const m = faixa?.extra?.match(/R\$\s*([\d.,]+)/);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Passo do slider que corresponde ao volume que o plano entrega naquele passo.
 *
 * Existe por causa de um descompasso real na modal de upgrade: no passo 0 o
 * card do Pro marketing já mostra "5.000 contatos / R$ 200", mas o slider
 * continuava em 1.000. Quem clicava comprava 5.000 vendo 1.000 na tela. Com
 * isto a modal encosta o slider no volume de fato escolhido.
 */
export function passoDoPlano(
  produto: "transactional" | "marketing",
  planoKey: string,
  passo: number,
): number {
  const passos =
    produto === "transactional" ? PASSOS_TRANSACIONAL : PASSOS_MARKETING;
  const faixa = precoNoPasso(planoKey, passo);
  if (!faixa) return passo;

  const rotulo = faixa.volume.trim().split(/\s+/)[0];
  const i = passos.indexOf(rotulo ?? "");
  // Nunca puxa o slider para trás: o passo escolhido é um piso de necessidade.
  return i >= 0 ? Math.max(i, passo) : passo;
}

export type EstadoDoCard = {
  precoBRL: number | null;
  volume: string;
  extra?: string;
  recomendado: boolean;
  esmaecido: boolean;
};

/**
 * Qual card é o recomendado em cada passo.
 *
 * Regra geral: o mais barato que atende o volume. Duas exceções copiadas do
 * Resend, ambas de propósito:
 *
 * - No primeiro passo ninguém leva badge — o Free é o plano atual.
 * - Em 100.000 no transacional, Pro e Scale ficam os dois acesos: é o ponto em
 *   que os dois atendem o mesmo volume, e o badge vai para o mais barato.
 */
export function estadoDoCard(
  produto: "transactional" | "marketing",
  planoKey: string,
  passo: number,
  precoFixo: number | null,
  volumeFixo: string,
): EstadoDoCard {
  const ultimoPasso =
    (produto === "transactional" ? PASSOS_TRANSACIONAL : PASSOS_MARKETING)
      .length - 1;

  const variavel = precoNoPasso(planoKey, passo);
  const precoBRL = variavel ? variavel.precoBRL : precoFixo;
  const volume = variavel ? variavel.volume : volumeFixo;
  const extra = variavel?.extra;

  const recomendado = ehRecomendado(produto, planoKey, passo, ultimoPasso);
  const aceso = estaAceso(produto, planoKey, passo, ultimoPasso);

  return { precoBRL, volume, extra, recomendado, esmaecido: !aceso };
}

function ehRecomendado(
  produto: "transactional" | "marketing",
  planoKey: string,
  passo: number,
  ultimoPasso: number,
): boolean {
  // Primeiro passo: nenhum badge, o Free é o plano atual.
  if (passo === 0) return false;
  if (passo === ultimoPasso) return planoKey === "enterprise";

  if (produto === "marketing") return planoKey === "pro_marketing";

  // Transacional: o Pro cobre até o passo 2 (100 mil); daí para cima é Scale.
  return passo <= 2 ? planoKey === "pro" : planoKey === "scale";
}

function estaAceso(
  produto: "transactional" | "marketing",
  planoKey: string,
  passo: number,
  ultimoPasso: number,
): boolean {
  if (passo === 0) return true; // estado inicial: nada esmaecido
  if (passo === ultimoPasso) return planoKey === "enterprise";

  if (produto === "marketing") return planoKey === "pro_marketing";

  // Em 100.000 os dois planos do meio atendem — os dois ficam acesos.
  if (passo === 2) return planoKey === "pro" || planoKey === "scale";
  return passo < 2 ? planoKey === "pro" : planoKey === "scale";
}
