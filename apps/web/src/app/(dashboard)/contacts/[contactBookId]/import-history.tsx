"use client";

import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { toast } from "@usesend/ui/src/toaster";
import { formatDistanceToNow } from "date-fns";
import { Download } from "lucide-react";

import { api } from "~/trpc/react";

/** Histórico de importações da lista, com o arquivo original para download. */
export default function ImportHistory({
  contactBookId,
}: {
  contactBookId: string;
}) {
  const listQuery = api.contactImport.list.useQuery(
    { contactBookId },
    {
      refetchInterval: (q) =>
        q.state.data?.some((i) => i.status === "processing") ? 2000 : false,
    },
  );
  const downloadMutation = api.contactImport.downloadUrl.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (e) => toast.error(e.message),
  });

  if (listQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!listQuery.data?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma importação por arquivo ainda.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Arquivo</TableHead>
            <TableHead>Quem importou</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Criados</TableHead>
            <TableHead className="text-right">Atualizados</TableHead>
            <TableHead className="text-right">Ignorados</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {listQuery.data.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(i.startedAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="max-w-[200px] truncate" title={i.fileName}>
                {i.fileName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {i.autor?.name ?? i.autor?.email ?? "—"}
              </TableCell>
              <TableCell>
                {i.status === "done" ? (
                  <Badge variant="outline">concluída</Badge>
                ) : i.status === "error" ? (
                  <Badge variant="destructive">erro</Badge>
                ) : (
                  <Badge variant="secondary">
                    {i.processed}/{i.total}
                  </Badge>
                )}
                {i.error ? (
                  <div
                    className="mt-1 max-w-[200px] truncate text-xs text-destructive"
                    title={i.error}
                  >
                    {i.error}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-right">{i.created}</TableCell>
              <TableCell className="text-right">{i.updated}</TableCell>
              <TableCell className="text-right">{i.skipped}</TableCell>
              <TableCell className="text-right">
                {i.arquivoDisponivel ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Baixar o arquivo usado"
                    onClick={() => downloadMutation.mutate({ id: i.id })}
                    disabled={downloadMutation.isPending}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
