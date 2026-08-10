// Catálogo de planos (compartilhado entre a página Planos do admin e a modal de
// upgrade). Valores em R$ são provisórios — ajustar aqui num lugar só.

export type PlanFeature = { label: string; ok: boolean };

export type CatalogPlan = {
  key: string; // free | pro | scale | enterprise | pro_marketing
  name: string;
  priceBRL: number | null; // null = Personalizado
  volume: string;
  extra?: string;
  features: PlanFeature[];
  cta: string;
  highlight?: boolean;
};

export const TRANSACTIONAL_TIERS = [
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

export const MARKETING_TIERS = [
  "1.000",
  "5.000",
  "10.000",
  "25.000",
  "50.000",
  "100.000",
  "150.000",
  "200.000+",
];

export const TRANSACTIONAL_PLANS: CatalogPlan[] = [
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
      { label: "100 e-mails por dia", ok: false },
      { label: "IPs dedicados", ok: false },
    ],
    cta: "Começar",
  },
  {
    key: "pro",
    name: "Pro",
    priceBRL: 20,
    volume: "50.000 e-mails / mês",
    extra: "E-mails extras: R$ 0,90 / 1.000",
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
  },
  {
    key: "scale",
    name: "Scale",
    priceBRL: 90,
    volume: "100.000 e-mails / mês",
    extra: "E-mails extras: R$ 0,90 / 1.000",
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
  },
  {
    key: "enterprise",
    name: "Enterprise",
    priceBRL: null,
    volume: "Um plano sob medida para a sua necessidade",
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
  },
];

export const MARKETING_PLANS: CatalogPlan[] = [
  {
    key: "free",
    name: "Free",
    priceBRL: 0,
    volume: "1.000 contatos",
    extra: "Envio de broadcasts ilimitado",
    features: [
      { label: "Suporte por ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "3 segmentos", ok: true },
      { label: "1 domínio", ok: true },
      { label: "5 créditos de IA / mês", ok: true },
      { label: "MCP", ok: false },
      { label: "Analytics de marketing", ok: false },
      { label: "IPs dedicados", ok: false },
    ],
    cta: "Começar",
  },
  {
    key: "pro_marketing",
    name: "Pro marketing",
    priceBRL: 40,
    volume: "5.000 contatos",
    extra: "Envio de broadcasts ilimitado",
    highlight: true,
    features: [
      { label: "Suporte via Slack e ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Segmentos ilimitados", ok: true },
      { label: "Domínios ilimitados", ok: true },
      { label: "100 créditos de IA / mês", ok: true },
      { label: "MCP", ok: true },
      { label: "Analytics de marketing", ok: true },
      { label: "IP dedicado como add-on", ok: false },
    ],
    cta: "Fazer upgrade",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    priceBRL: null,
    volume: "Um plano sob medida para a sua necessidade",
    extra: "Envio de broadcasts ilimitado",
    features: [
      { label: "Suporte prioritário", ok: true },
      { label: "Segmentos ilimitados", ok: true },
      { label: "Domínios ilimitados", ok: true },
      { label: "Créditos de IA flexíveis", ok: true },
      { label: "MCP", ok: true },
      { label: "Analytics de marketing", ok: true },
      { label: "IPs dedicados inclusos", ok: true },
    ],
    cta: "Fale conosco",
  },
];

export function priceLabel(p: CatalogPlan): string {
  if (p.priceBRL === null) return "Personalizado";
  return `R$ ${p.priceBRL.toFixed(0)}`;
}
