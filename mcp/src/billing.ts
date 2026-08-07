// ---- Cobrança por CONTATO ----
// O plano agora vem dos escopos da integração (McpKey no banco), não mais do env.
export type Plan = { pricePerContactBRL: number; minContacts: number };

export type BillingSummary = {
  pricePerContactBRL: number | null;
  minContacts: number | null;
  contacts: number; // contatos atuais
  billableContacts: number; // max(contacts, minContacts)
  monthlyCostBRL: number | null;
};

export function summarizeBilling(
  plan: Plan | undefined,
  contactCount: number,
): BillingSummary {
  const billable = Math.max(contactCount, plan?.minContacts ?? 0);
  const cost = plan
    ? Math.round(billable * plan.pricePerContactBRL * 100) / 100
    : null;
  return {
    pricePerContactBRL: plan?.pricePerContactBRL ?? null,
    minContacts: plan?.minContacts ?? null,
    contacts: contactCount,
    billableContacts: billable,
    monthlyCostBRL: cost,
  };
}
