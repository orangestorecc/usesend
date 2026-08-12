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
import { AutomationRunStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

import Spinner from "@usesend/ui/src/spinner";
import { Button } from "@usesend/ui/src/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@usesend/ui/src/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { api } from "~/trpc/react";
import { useUrlState } from "~/hooks/useUrlState";
import { EmptyState } from "~/components/EmptyState";
import { TableRowsSkeleton } from "~/components/skeletons";
import { ListChecks } from "lucide-react";

import AutomationStatusBadge from "../automation-status-badge";
import RunStatusBadge from "../run-status-badge";
import ToggleAutomation from "../toggle-automation";
import DuplicateAutomation from "../duplicate-automation";
import DeleteAutomation from "../delete-automation";

const RUN_STATUS_LABELS: Record<string, string> = {
  [AutomationRunStatus.RUNNING]: "Em execução",
  [AutomationRunStatus.WAITING]: "Aguardando",
  [AutomationRunStatus.COMPLETED]: "Concluída",
  [AutomationRunStatus.FAILED]: "Falhou",
  [AutomationRunStatus.CANCELLED]: "Cancelada",
};

export default function AutomationDetailPage({
  params,
}: {
  params: Promise<{ automationId: string }>;
}) {
  const { automationId } = use(params);
  const router = useRouter();
  const [status, setStatus] = useUrlState("status");
  const [cursor, setCursor] = useUrlState("cursor");

  const { data: automation, isLoading } = api.automation.get.useQuery({
    id: automationId,
  });

  const runsQuery = api.automation.listRuns.useQuery({
    automationId,
    status: (status as AutomationRunStatus | null) ?? undefined,
    cursor: cursor ?? undefined,
    limit: 20,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="w-5 h-5 text-foreground" />
      </div>
    );
  }

  if (!automation) {
    return <div>Automação não encontrada</div>;
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center">
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
              <BreadcrumbPage className="text-lg">
                <div className="flex items-center gap-2">
                  <div className="max-w-[300px] truncate">
                    {automation.name}
                  </div>
                  <AutomationStatusBadge status={automation.status} />
                </div>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-3">
          <Link href={`/automations/${automation.id}/edit`}>
            <Button variant="outline">Editar</Button>
          </Link>
          <ToggleAutomation automation={automation} mode="full" />
          <DuplicateAutomation
            automation={automation}
            trigger={<Button variant="outline">Duplicar</Button>}
          />
          <DeleteAutomation automation={automation} />
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 max-w-xl">
        <div className="border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Gatilho</div>
          <div className="font-mono text-sm mt-1">
            {automation.triggerEventName}
          </div>
        </div>
        <div className="border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">
            Atualizada
          </div>
          <div className="text-sm mt-1">
            {formatDistanceToNow(new Date(automation.updatedAt), {
              addSuffix: true,
            })}
          </div>
        </div>
      </div>

      <div className="mt-16">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-foreground">
            Histórico de execuções
          </h2>
          <Select
            value={status ?? "all"}
            onValueChange={(val) => {
              setStatus(val === "all" ? null : val);
              setCursor(null);
            }}
          >
            <SelectTrigger className="w-[180px]">
              {status ? (RUN_STATUS_LABELS[status] ?? status) : "Todos os status"}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.values(AutomationRunStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {RUN_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {runsQuery.isLoading ? (
          <Table>
            <TableBody>
              <TableRowsSkeleton rows={5} cols={5} />
            </TableBody>
          </Table>
        ) : runsQuery.data?.runs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Etapa atual</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead>Atualizada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsQuery.data.runs.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/automations/${automation.id}/runs/${run.id}`)
                  }
                >
                  <TableCell className="font-mono text-xs">
                    {run.contactId}
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {run.currentStepKey ?? "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.updatedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="Nenhuma execução encontrada"
            description="As execuções aparecerão aqui assim que a automação for disparada."
          />
        )}

        <div className="flex gap-4 justify-end mt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={!runsQuery.data?.nextCursor}
            onClick={() => setCursor(runsQuery.data?.nextCursor ?? null)}
          >
            Próxima página
          </Button>
        </div>
      </div>
    </div>
  );
}
