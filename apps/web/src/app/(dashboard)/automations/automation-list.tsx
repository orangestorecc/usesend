"use client";

import { api } from "~/trpc/react";
import { Workflow } from "lucide-react";
import AutomationCard from "./automation-card";
import { EmptyState } from "~/components/EmptyState";
import { CardsSkeleton } from "~/components/skeletons";

export default function AutomationList() {
  const automationsQuery = api.automation.list.useQuery();

  return (
    <div className="mt-10 flex flex-col gap-8">
      {automationsQuery.isLoading ? (
        <CardsSkeleton count={4} />
      ) : automationsQuery.data?.length ? (
        automationsQuery.data.map((automation) => (
          <AutomationCard key={automation.id} automation={automation} />
        ))
      ) : (
        <EmptyState
          icon={Workflow}
          title="Nenhuma automação encontrada"
          description="Crie sua primeira automação para começar."
        />
      )}
    </div>
  );
}
