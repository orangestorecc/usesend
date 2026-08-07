// ---- Cobrança por CONTATO ----
// Modelo (definido 30/07/2026): R$X por contato/mês, com mínimo de N contatos.
// Configurado via env MCP_PLANS. Formato:
//   msk_cliente=nomePlano:precoPorContatoBRL:minContatos ; msk_outro=...
// Ex.: MCP_PLANS=msk_test=padrao:0.10:1000
export type Plan = {
  name: string;
  pricePerContactBRL: number;
  minContacts: number;
};

const plans = new Map<string, Plan>();
for (const pair of (process.env.MCP_PLANS ?? "").split(";")) {
  const [tok, spec] = pair.split("=");
  if (!tok || !spec) continue;
  const [name, price, min] = spec.split(":");
  plans.set(tok.trim(), {
    name: (name ?? "custom").trim(),
    pricePerContactBRL: Number(price ?? 0),
    minContacts: Number(min ?? 0),
  });
}

export type BillingSummary = {
  plan: string | null;
  pricePerContactBRL: number | null;
  minContacts: number | null;
  contacts: number; // contatos atuais
  billableContacts: number; // max(contacts, minContacts)
  monthlyCostBRL: number | null;
};

export type ClientBilling = {
  plan?: Plan;
  summary: (contactCount: number) => BillingSummary;
};

export function forClient(token: string): ClientBilling {
  const plan = plans.get(token);

  const summary = (contactCount: number): BillingSummary => {
    const billable = Math.max(contactCount, plan?.minContacts ?? 0);
    const cost = plan
      ? Math.round(billable * plan.pricePerContactBRL * 100) / 100
      : null;
    return {
      plan: plan?.name ?? null,
      pricePerContactBRL: plan?.pricePerContactBRL ?? null,
      minContacts: plan?.minContacts ?? null,
      contacts: contactCount,
      billableContacts: billable,
      monthlyCostBRL: cost,
    };
  };

  return { plan, summary };
}
