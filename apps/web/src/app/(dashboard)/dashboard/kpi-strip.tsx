"use client";

import { api } from "~/trpc/react";
import { Skeleton } from "@usesend/ui/src/skeleton";

interface KpiStripProps {
  days: number;
  domain: string | null;
  campaign?: string | null;
}

const nf = new Intl.NumberFormat("pt-BR");
const pct = (n: number) =>
  `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

export function KpiStrip({ days, domain, campaign }: KpiStripProps) {
  const domainId = domain ? Number(domain) : undefined;
  const query = api.dashboard.emailTimeSeries.useQuery({
    days,
    domain: domainId,
    campaignId: campaign ?? undefined,
  });

  const t = query.data?.totalCounts;
  const sent = t?.sent ?? 0;
  const delivered = t?.delivered ?? 0;
  const opened = t?.opened ?? 0;
  const bounced = t?.bounced ?? 0;

  const kpis = [
    {
      label: "Enviados",
      dot: "bg-muted-foreground",
      value: nf.format(sent),
    },
    {
      label: "Entregues",
      dot: "bg-success",
      value: sent ? pct((delivered / sent) * 100) : "—",
    },
    {
      label: "Aberturas",
      dot: "bg-muted-foreground",
      value: delivered ? pct((opened / delivered) * 100) : "—",
    },
    {
      label: "Bounce",
      dot: "bg-destructive",
      value: sent ? pct((bounced / sent) * 100) : "—",
    },
  ];

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-[18px]">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="mt-4 h-8 w-28 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-lg border border-border bg-card p-[18px]"
        >
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${k.dot}`} />
            {k.label}
          </div>
          <div className="mt-3 font-mono text-3xl font-semibold tracking-tight">
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}
