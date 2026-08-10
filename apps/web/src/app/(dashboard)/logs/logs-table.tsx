"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { Input } from "@usesend/ui/src/input";
import { Button } from "@usesend/ui/src/button";
import { formatDistanceToNow } from "date-fns";
import { useDebouncedCallback } from "use-debounce";
import { api } from "~/trpc/react";

const AGENTS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os agentes" },
  { value: "mcp", label: "MCP" },
  { value: "go", label: "Go" },
  { value: "curl", label: "cURL" },
  { value: "http", label: "HTTP / Outro" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "success", label: "Sucessos (2xx)" },
  { value: "error", label: "Erros (4xx/5xx)" },
  { value: "code:200", label: "200 · OK" },
  { value: "code:201", label: "201 · Created" },
  { value: "code:400", label: "400 · Bad request" },
  { value: "code:401", label: "401 · Unauthorized" },
  { value: "code:403", label: "403 · Forbidden" },
  { value: "code:404", label: "404 · Not found" },
  { value: "code:422", label: "422 · Unprocessable" },
  { value: "code:429", label: "429 · Too many requests" },
  { value: "code:500", label: "500 · Server error" },
];

function StatusBadge({ code }: { code: number }) {
  const color =
    code >= 200 && code < 300
      ? "bg-emerald-100 text-emerald-700"
      : code >= 400
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {code}
    </span>
  );
}

export default function LogsTable() {
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("7");
  const [statusSel, setStatusSel] = useState("all");
  const [agent, setAgent] = useState("all");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, 400);

  const status = statusSel.startsWith("code:")
    ? undefined
    : (statusSel as "all" | "success" | "error");
  const statusCode = statusSel.startsWith("code:")
    ? Number(statusSel.split(":")[1])
    : undefined;

  const sourcesQuery = api.apiLog.sources.useQuery();
  const listQuery = api.apiLog.list.useQuery({
    days: Number(days),
    status,
    statusCode,
    source: agent === "all" ? undefined : agent,
    apiKeyName: source === "all" ? undefined : source,
    search: search || undefined,
    page,
  });

  return (
    <div className="mt-6 space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar endpoint..."
          className="max-w-xs"
          onChange={(e) => debouncedSearch(e.target.value)}
        />
        <Select
          value={days}
          onValueChange={(v) => {
            setDays(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="15">Últimos 15 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusSel}
          onValueChange={(v) => {
            setStatusSel(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={agent}
          onValueChange={(v) => {
            setAgent(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={source}
          onValueChange={(v) => {
            setSource(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Todas as fontes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            {sourcesQuery.data?.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endpoint</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Agente</TableHead>
              <TableHead className="text-right">Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : listQuery.data?.logs.length ? (
              listQuery.data.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    {log.endpoint}
                  </TableCell>
                  <TableCell>
                    <StatusBadge code={log.statusCode} />
                  </TableCell>
                  <TableCell className="text-sm">{log.method}</TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">
                    {log.source}
                    {log.apiKeyName ? ` · ${log.apiKeyName}` : ""}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Nenhuma requisição registrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {listQuery.data?.totalPage ?? 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= (listQuery.data?.totalPage ?? 1)}
          onClick={() => setPage((p) => p + 1)}
        >
          Próximo
        </Button>
      </div>
    </div>
  );
}
