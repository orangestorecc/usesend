"use client";

import { Fragment, useState } from "react";
import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import { api } from "~/trpc/react";

type Provider = "inter" | "rede";

function StatusBadge({
  success,
  status,
}: {
  success: boolean;
  status: number | null;
}) {
  return (
    <Badge variant={success ? "outline" : "destructive"}>
      {status ?? (success ? "ok" : "erro")}
    </Badge>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Log de transações do gateway: chamadas que fazemos (GET/POST/PUT) e webhooks
 * recebidos. Dados sensíveis já vêm redigidos do servidor.
 */
export function GatewayLogs({ provider }: { provider: Provider }) {
  const [direction, setDirection] = useState<"all" | "outbound" | "inbound">(
    "all",
  );
  const [status, setStatus] = useState<"all" | "success" | "error">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = api.paymentGateway.logs.useQuery({
    provider,
    direction,
    status,
    search: search || undefined,
    page,
  });

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.perPage))
    : 1;

  return (
    <div className="rounded-xl border shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6">
        <div>
          <h2 className="text-base font-semibold">Log de transações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Requisições enviadas e webhooks recebidos. Retenção de{" "}
            {query.data?.retentionDays ?? 90} dias. Dados sensíveis (cartão,
            CVV, chaves) não são gravados.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b p-4">
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={direction}
          onChange={(e) => {
            setDirection(e.target.value as typeof direction);
            setPage(1);
          }}
        >
          <option value="all">Todas as direções</option>
          <option value="outbound">Enviadas (nós → gateway)</option>
          <option value="inbound">Webhooks recebidos</option>
        </select>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
        >
          <option value="all">Todos os status</option>
          <option value="success">Sucesso</option>
          <option value="error">Erro</option>
        </select>
        <Input
          className="h-9 w-56"
          placeholder="Buscar rota, operação, cobrança…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {query.isLoading ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">Carregando…</p>
      ) : query.data?.logs.length ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Data</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.logs.map((log) => {
                const isOpen = expanded === log.id;
                return (
                  <Fragment key={log.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : log.id)}
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {log.direction === "inbound" ? (
                            <ArrowDownLeftIcon className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <ArrowUpRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="font-mono text-xs">
                            {log.operation ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{log.method}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          success={log.success}
                          status={log.responseStatus}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {log.durationMs != null ? `${log.durationMs}ms` : "—"}
                      </TableCell>
                    </TableRow>
                    {isOpen ? (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/20">
                          <div className="space-y-3 p-2">
                            <div className="break-all font-mono text-xs">
                              <span className="text-muted-foreground">
                                URL:{" "}
                              </span>
                              {log.url}
                            </div>
                            {log.chargeId ? (
                              <div className="font-mono text-xs">
                                <span className="text-muted-foreground">
                                  Cobrança:{" "}
                                </span>
                                {log.chargeId}
                              </div>
                            ) : null}
                            {log.error ? (
                              <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                                {log.error}
                              </div>
                            ) : null}
                            <div className="flex flex-col gap-3 sm:flex-row">
                              <JsonBlock
                                label="Requisição"
                                value={log.requestBody}
                              />
                              <JsonBlock
                                label="Resposta"
                                value={log.responseBody}
                              />
                            </div>
                            {log.requestHeaders ? (
                              <JsonBlock
                                label="Headers"
                                value={log.requestHeaders}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t px-6 py-3 text-sm">
            <span className="text-muted-foreground">
              {query.data.total} registro(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="px-6 py-8 text-sm text-muted-foreground">
          Nenhuma transação registrada ainda.
        </p>
      )}
    </div>
  );
}
