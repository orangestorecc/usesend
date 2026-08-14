/**
 * Catálogo de planos — uma fonte só para a vitrine e para o app.
 *
 * Antes existiam três listas: a do site (`PricingPlans`), a do app
 * (`plan-catalog`) e a tabela do admin. Elas já discordavam em preço (Pro a
 * R$ 100 no site e R$ 20 no app), em nome de feature ("Análises" x
 * "Analytics") e no texto do Enterprise. Anunciar uma coisa e mostrar outra na
 * hora do upgrade é o tipo de divergência que só aparece com o cliente
 * reclamando — então a lista mora aqui, ao lado da matriz de preços, e todo
 * mundo lê daqui.
 *
 * O preço fixo daqui só vale para os planos sem faixa variável (Free e
 * Enterprise). Para Pro, Scale e Pro marketing quem manda é `precoNoPasso`.
 */

export type FeaturePlano = { label: string; ok: boolean };

export type PlanoDoCatalogo = {
  key: string;
  name: string;
  /** null = personalizado (Enterprise), sem preço de tabela. */
  priceBRL: number | null;
  volume: string;
  extra?: string;
  features: FeaturePlano[];
  /** Rótulo do botão na área logada (modal de upgrade / admin). */
  cta: string;
  /**
   * Rótulo do botão na vitrine pública, onde ninguém tem conta ainda.
   * Opcional porque as linhas editadas no admin só guardam o `cta` do app.
   */
  ctaSite?: string;
  highlight?: boolean;
};

const ENTERPRISE_VOLUME = "Um plano sob medida para a sua operação";

export const CATALOGO_TRANSACIONAL: PlanoDoCatalogo[] = [
  {
    key: "free",
    name: "Free",
    priceBRL: 0,
    volume: "3.000 e-mails / mês",
    features: [
      { label: "Envio e recebimento", ok: true },
      { label: "Suporte por ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Retenção de dados por 30 dias", ok: true },
      { label: "1 domínio", ok: true },
      { label: "5 créditos de IA / mês", ok: true },
      { label: "Sem limite diário", ok: false },
      { label: "IPs dedicados", ok: false },
    ],
    cta: "Começar",
    ctaSite: "Começar de graça",
  },
  {
    key: "pro",
    name: "Pro",
    priceBRL: 100,
    volume: "50.000 e-mails / mês",
    extra: "E-mails extras: R$ 4,50 / 1.000",
    highlight: true,
    features: [
      { label: "Envio e recebimento", ok: true },
      { label: "Suporte por ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Retenção de dados por 30 dias", ok: true },
      { label: "10 domínios", ok: true },
      { label: "100 créditos de IA / mês", ok: true },
      { label: "Sem limite diário", ok: true },
      { label: "IPs dedicados", ok: false },
    ],
    cta: "Fazer upgrade",
    ctaSite: "Assinar Pro",
  },
  {
    key: "scale",
    name: "Scale",
    priceBRL: 450,
    volume: "100.000 e-mails / mês",
    extra: "E-mails extras: R$ 4,50 / 1.000",
    features: [
      { label: "Envio e recebimento", ok: true },
      { label: "Suporte via Slack e ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Retenção de dados por 30 dias", ok: true },
      { label: "1.000 domínios", ok: true },
      { label: "500 créditos de IA / mês", ok: true },
      { label: "Sem limite diário", ok: true },
      { label: "IP dedicado como add-on", ok: true },
    ],
    cta: "Fazer upgrade",
    ctaSite: "Assinar Scale",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    priceBRL: null,
    volume: ENTERPRISE_VOLUME,
    features: [
      { label: "Envio e recebimento", ok: true },
      { label: "Suporte prioritário", ok: true },
      { label: "Execuções flexíveis", ok: true },
      { label: "Retenção flexível", ok: true },
      { label: "Domínios flexíveis", ok: true },
      { label: "Créditos de IA flexíveis", ok: true },
      { label: "Sem limite diário", ok: true },
      { label: "IPs dedicados como add-on", ok: true },
    ],
    cta: "Fale conosco",
    ctaSite: "Fale conosco",
  },
];

export const CATALOGO_MARKETING: PlanoDoCatalogo[] = [
  {
    key: "free",
    name: "Free",
    priceBRL: 0,
    volume: "1.000 contatos",
    extra: "Envio de campanhas ilimitado",
    features: [
      { label: "Suporte por ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "3 segmentos", ok: true },
      { label: "1 domínio", ok: true },
      { label: "5 créditos de IA / mês", ok: true },
      { label: "MCP", ok: false },
      { label: "Análises de marketing", ok: false },
      { label: "IPs dedicados", ok: false },
    ],
    cta: "Começar",
    ctaSite: "Começar de graça",
  },
  {
    key: "pro_marketing",
    name: "Pro marketing",
    priceBRL: 200,
    volume: "5.000 contatos",
    extra: "Envio de campanhas ilimitado",
    highlight: true,
    features: [
      { label: "Suporte via Slack e ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Segmentos ilimitados", ok: true },
      { label: "Domínios ilimitados", ok: true },
      { label: "100 créditos de IA / mês", ok: true },
      { label: "MCP", ok: true },
      { label: "Análises de marketing", ok: true },
      { label: "IP dedicado como add-on", ok: false },
    ],
    cta: "Fazer upgrade",
    ctaSite: "Assinar Pro marketing",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    priceBRL: null,
    volume: ENTERPRISE_VOLUME,
    extra: "Envio de campanhas ilimitado",
    features: [
      { label: "Suporte prioritário", ok: true },
      { label: "Segmentos ilimitados", ok: true },
      { label: "Domínios ilimitados", ok: true },
      { label: "Créditos de IA flexíveis", ok: true },
      { label: "MCP", ok: true },
      { label: "Análises de marketing", ok: true },
      { label: "IPs dedicados inclusos", ok: true },
    ],
    cta: "Fale conosco",
    ctaSite: "Fale conosco",
  },
];

export function catalogoDoProduto(
  produto: "transactional" | "marketing",
): PlanoDoCatalogo[] {
  return produto === "marketing" ? CATALOGO_MARKETING : CATALOGO_TRANSACIONAL;
}

/**
 * Extras (pay-as-you-go) e add-ons.
 *
 * `precoPorMilBRL` é só o piso usado por quem não tem faixa variável: para
 * quem está num plano pago vale `precoExcedenteBRL(plano, passo)`, que é o
 * preço que o /pricing anunciou para aquele volume.
 */
export const EXTRAS = {
  transacional: { precoPorMilBRL: 4.5 },
  automacoes: { precoPorExecucaoBRL: 0.0075, execucoesInclusas: 10000 },
};

export const ADDONS = {
  ipDedicado: { precoMensalBRL: 150 },
};

/**
 * Planos que vendem o add-on de IP dedicado.
 *
 * Sai daqui, e nao do enum `Plan` do banco, porque o enum so distingue
 * FREE/BASIC: quem checa `PLAN_LIMITS[plan].dedicatedIp` libera o add-on para
 * qualquer plano pago, inclusive o Pro — que nesta mesma tabela diz
 * "IPs dedicados: nao". Vender o que a vitrine nega e cobrar pelo que nao foi
 * prometido.
 */
export const PLANOS_COM_IP_DEDICADO = ["scale", "enterprise"] as const;

/** Nome comercial do plano mais barato que tem o add-on, para a copy da UI. */
export const PLANO_MINIMO_IP_DEDICADO = "Scale";

export function planoTemIpDedicado(planKey: string | null | undefined): boolean {
  if (!planKey) return false;
  return (PLANOS_COM_IP_DEDICADO as readonly string[]).includes(planKey);
}
