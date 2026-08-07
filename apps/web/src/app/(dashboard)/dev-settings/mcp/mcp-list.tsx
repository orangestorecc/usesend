"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import Spinner from "@usesend/ui/src/spinner";
import { Button } from "@usesend/ui/src/button";
import { Trash2 } from "lucide-react";
import { toast } from "@usesend/ui/src/toaster";

type Scopes = {
  contacts?: string;
  lists?: string;
  templates?: string;
  segments?: string;
  campaigns?: string;
  analytics?: string;
  send?: boolean;
};

function scopeSummary(scopes: Scopes) {
  const short = (v?: string) => (v === "write" ? "rw" : v === "read" ? "r" : "—");
  return [
    `contatos:${short(scopes.contacts)}`,
    `listas:${short(scopes.lists)}`,
    `templates:${short(scopes.templates)}`,
    `segmentos:${short(scopes.segments)}`,
    `campanhas:${short(scopes.campaigns)}`,
    `relatórios:${short(scopes.analytics)}`,
    `envio:${scopes.send ? "on" : "off"}`,
  ].join(" · ");
}

export default function McpList() {
  const keysQuery = api.mcp.getMcpKeys.useQuery();
  const deleteMutation = api.mcp.deleteMcpKey.useMutation();
  const utils = api.useUtils();

  function handleDelete(id: string) {
    if (!confirm("Revogar esta integração MCP? O cliente perde o acesso.")) {
      return;
    }
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          utils.mcp.invalidate();
          toast.success("Integração revogada");
        },
      }
    );
  }

  return (
    <div className="mt-10">
      <div className="border rounded-xl shadow">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="rounded-tl-xl">Nome</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Escopos</TableHead>
              <TableHead>Último uso</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="rounded-tr-xl">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keysQuery.isLoading ? (
              <TableRow className="h-32">
                <TableCell colSpan={6} className="text-center py-4">
                  <Spinner
                    className="w-6 h-6 mx-auto"
                    innerSvgClass="stroke-primary"
                  />
                </TableCell>
              </TableRow>
            ) : keysQuery.data?.length === 0 ? (
              <TableRow className="h-32">
                <TableCell colSpan={6} className="text-center py-4">
                  <p>Nenhuma integração MCP criada</p>
                </TableCell>
              </TableRow>
            ) : (
              keysQuery.data?.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.name}</TableCell>
                  <TableCell>{k.partialToken}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {scopeSummary((k.scopes ?? {}) as Scopes)}
                  </TableCell>
                  <TableCell>
                    {k.lastUsed
                      ? formatDistanceToNow(k.lastUsed, { addSuffix: true })
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(k.createdAt, { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(k.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
