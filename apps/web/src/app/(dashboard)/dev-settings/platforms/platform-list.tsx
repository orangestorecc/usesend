"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { Button } from "@usesend/ui/src/button";
import { Switch } from "@usesend/ui/src/switch";
import { Badge } from "@usesend/ui/src/badge";
import { toast } from "@usesend/ui/src/toaster";
import { RefreshCw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";

function StatusBadge({
  status,
  count,
}: {
  status: string | null;
  count: number;
}) {
  if (status === "ok")
    return <Badge variant="outline">Sincronizado ({count})</Badge>;
  if (status === "running") return <Badge variant="secondary">Rodando…</Badge>;
  if (status === "error") return <Badge variant="destructive">Erro</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

export default function PlatformList() {
  const utils = api.useUtils();
  const listQuery = api.platformIntegration.list.useQuery();
  const booksQuery = api.platformIntegration.contactBooks.useQuery();
  const updateMutation = api.platformIntegration.update.useMutation({
    onSuccess: () => utils.platformIntegration.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const syncMutation = api.platformIntegration.syncNow.useMutation({
    onSuccess: () => {
      toast.success("Sincronização enfileirada.");
      utils.platformIntegration.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = api.platformIntegration.delete.useMutation({
    onSuccess: () => {
      toast.success("Integração removida.");
      utils.platformIntegration.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const bookName = (id: string) =>
    booksQuery.data?.find((b) => b.id === id)?.name ?? "—";

  if (listQuery.isLoading) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
    );
  }

  if (!listQuery.data?.length) {
    return (
      <div className="mt-8 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nenhuma plataforma conectada ainda. Adicione a primeira acima.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Lista</TableHead>
            <TableHead>Intervalo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Último sync</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listQuery.data.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.name}</TableCell>
              <TableCell className="capitalize">{i.provider}</TableCell>
              <TableCell>{bookName(i.contactBookId)}</TableCell>
              <TableCell>{i.intervalMinutes} min</TableCell>
              <TableCell>
                <StatusBadge status={i.lastSyncStatus} count={i.lastSyncCount} />
                {i.lastSyncStatus === "error" && i.lastSyncError ? (
                  <div
                    className="mt-1 max-w-[200px] truncate text-xs text-destructive"
                    title={i.lastSyncError}
                  >
                    {i.lastSyncError}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {i.lastSyncedAt
                  ? formatDistanceToNow(new Date(i.lastSyncedAt), {
                      addSuffix: true,
                    })
                  : "—"}
              </TableCell>
              <TableCell>
                <Switch
                  checked={i.enabled}
                  onCheckedChange={(enabled) =>
                    updateMutation.mutate({ id: i.id, enabled })
                  }
                />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncMutation.mutate({ id: i.id })}
                    disabled={syncMutation.isPending}
                    title="Sincronizar agora"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Remover a integração "${i.name}"?`)) {
                        deleteMutation.mutate({ id: i.id });
                      }
                    }}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
