import { describe, expect, it } from "vitest";

import {
  buildCustomerKpis,
  type CustomerFinancials,
} from "./customer-insights";

function fin(
  teamId: number,
  over: Partial<CustomerFinancials> = {},
): CustomerFinancials {
  return {
    teamId,
    planKey: "pro",
    planName: "Pro",
    totalPaidCents: 0,
    monthlyPriceCents: 2000,
    mrrCents: 2000,
    billingStatus: "em_dia",
    currentPeriodEnd: null,
    overdueInvoices: 0,
    billingBlockedAt: null,
    ...over,
  };
}

describe("buildCustomerKpis", () => {
  it("conta free, pagos e converte sobre o total da base", () => {
    const teams = [
      { id: 1, plan: "FREE" as const, planKey: "free", planProduct: "transactional" },
      { id: 2, plan: "FREE" as const, planKey: "free", planProduct: "transactional" },
      { id: 3, plan: "BASIC" as const, planKey: "pro", planProduct: "transactional" },
      { id: 4, plan: "BASIC" as const, planKey: "pro", planProduct: "transactional" },
    ];
    const financials = new Map([
      [1, fin(1, { billingStatus: "free", mrrCents: 0, monthlyPriceCents: 0 })],
      [2, fin(2, { billingStatus: "free", mrrCents: 0, monthlyPriceCents: 0 })],
      [3, fin(3)],
      [4, fin(4)],
    ]);

    const kpis = buildCustomerKpis(teams, financials);

    expect(kpis.totalCustomers).toBe(4);
    expect(kpis.freeCustomers).toBe(2);
    expect(kpis.paidCustomers).toBe(2);
    expect(kpis.conversionRate).toBe(50);
    expect(kpis.mrrCents).toBe(4000);
    expect(kpis.arpuCents).toBe(2000);
  });

  it("tira o inadimplente do MRR e o joga no MRR em risco", () => {
    const teams = [
      { id: 1, plan: "BASIC" as const, planKey: "pro", planProduct: "transactional" },
      { id: 2, plan: "BASIC" as const, planKey: "pro", planProduct: "transactional" },
    ];
    const financials = new Map([
      [1, fin(1)],
      [
        2,
        fin(2, {
          billingStatus: "atrasado",
          mrrCents: 0,
          monthlyPriceCents: 9000,
          overdueInvoices: 1,
        }),
      ],
    ]);

    const kpis = buildCustomerKpis(teams, financials);

    expect(kpis.mrrCents).toBe(2000);
    expect(kpis.mrrAtRiskCents).toBe(9000);
    expect(kpis.overdueCustomers).toBe(1);
    // ARPU divide pelos que pagam de fato, não pelos "pagos" nominais.
    expect(kpis.arpuCents).toBe(2000);
  });

  it("não divide por zero com a base vazia", () => {
    const kpis = buildCustomerKpis([], new Map());
    expect(kpis.conversionRate).toBe(0);
    expect(kpis.arpuCents).toBe(0);
  });
});
