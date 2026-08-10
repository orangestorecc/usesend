"use client";

import { H1 } from "@usesend/ui";
import LogsTable from "./logs-table";

export default function LogsPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <H1>Logs</H1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Requisições recebidas pela sua API pública (/v1).
      </p>
      <LogsTable />
    </div>
  );
}
