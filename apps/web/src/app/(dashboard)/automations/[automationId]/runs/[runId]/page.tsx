"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@usesend/ui/src/breadcrumb";
import Link from "next/link";
import { use } from "react";
import { format } from "date-fns";

import Spinner from "@usesend/ui/src/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@usesend/ui/src/card";
import { api } from "~/trpc/react";
import RunStatusBadge from "../../../run-status-badge";

export default function AutomationRunDetailPage({
  params,
}: {
  params: Promise<{ automationId: string; runId: string }>;
}) {
  const { automationId, runId } = use(params);

  const { data: run, isLoading } = api.automation.getRun.useQuery({
    id: runId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="w-5 h-5 text-foreground" />
      </div>
    );
  }

  if (!run) {
    return <div>Execução não encontrada</div>;
  }

  return (
    <div className="container mx-auto">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/automations" className="text-lg">
                Automações
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-lg" />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/automations/${automationId}`} className="text-lg">
                {run.automation.name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-lg" />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-lg">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{run.contact.email}</span>
                <RunStatusBadge status={run.status} />
              </div>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {run.error ? (
        <div className="mt-6 rounded-lg border border-red/20 bg-red/10 p-4 text-sm text-red">
          {run.error}
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-foreground mb-4">
          Linha do tempo
        </h2>
        <div className="flex flex-col gap-4">
          {run.stepRuns.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhuma etapa executada ainda.
            </div>
          ) : (
            run.stepRuns.map((stepRun, index) => (
              <Card key={stepRun.id} className="relative">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    {stepRun.stepKey}
                  </CardTitle>
                  <div
                    className={`text-xs rounded px-2 py-1 capitalize ${
                      stepRun.status === "completed"
                        ? "bg-green/15 text-green border border-green/20"
                        : "bg-red/15 text-red border border-red/20"
                    }`}
                  >
                    {stepRun.status === "completed" ? "Concluída" : "Falhou"}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Iniciada em{" "}
                    {format(new Date(stepRun.startedAt), "dd/MM/yyyy HH:mm:ss")}
                    {stepRun.finishedAt
                      ? ` · Finalizada em ${format(
                          new Date(stepRun.finishedAt),
                          "dd/MM/yyyy HH:mm:ss",
                        )}`
                      : null}
                  </div>
                  {stepRun.error ? (
                    <div className="text-sm text-red">{stepRun.error}</div>
                  ) : null}
                  {stepRun.output ? (
                    <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto">
                      {JSON.stringify(stepRun.output, null, 2)}
                    </pre>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
