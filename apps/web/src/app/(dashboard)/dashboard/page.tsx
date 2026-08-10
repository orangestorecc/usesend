"use client";

import EmailChart from "./email-chart";
import DashboardFilters from "./dashboard-filters";
import { H1 } from "@usesend/ui";
import { useUrlState } from "~/hooks/useUrlState";
import { ReputationMetrics } from "./reputation-metrics";
import { KpiStrip } from "./kpi-strip";
import { RecentEmails } from "./recent-emails";

export default function Dashboard() {
  const [days, setDays] = useUrlState("days", "30");
  const [domain, setDomain] = useUrlState("domain");
  const [campaign, setCampaign] = useUrlState("campaign");
  const numDays = Number(days ?? "30");

  return (
    <div>
      <div className="w-full">
        <div className="flex justify-between items-start mb-8">
          <div>
            <H1>Análises</H1>
            <p className="mt-1 text-sm text-muted-foreground">
              Visão geral de entregabilidade — últimos {numDays} dias.
            </p>
          </div>
          <DashboardFilters
            days={days ?? "30"}
            setDays={setDays}
            domain={domain}
            setDomain={setDomain}
            campaign={campaign}
            setCampaign={setCampaign}
          />
        </div>
        <div className="space-y-8">
          <KpiStrip days={numDays} domain={domain} campaign={campaign} />

          <EmailChart days={numDays} domain={domain} campaign={campaign} />

          <RecentEmails />

          <ReputationMetrics
            days={numDays}
            domain={domain}
            campaign={campaign}
          />
        </div>
      </div>
    </div>
  );
}
