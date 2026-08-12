"use client";

import Link from "next/link";
import { H1 } from "@usesend/ui";
import LogsTable from "./logs-table";

export default function LogsPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <H1>Logs</H1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Requisições recebidas pela sua API pública (/v1). Esta tela não guarda
        e-mails: todo e-mail enviado pela plataforma — inclusive os pedidos de
        confirmação de double opt-in — fica em{" "}
        <Link href="/emails" className="underline">
          Emails
        </Link>
        , com o histórico de entrega de cada um.
      </p>
      <LogsTable />
    </div>
  );
}
