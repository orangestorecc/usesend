"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";

import {
  AUDIT_EVENTOS_DESTRUTIVOS,
  AUDIT_EVENTS,
} from "~/server/service/audit-service";
import { api } from "~/trpc/react";

const ROTULOS: Record<string, string> = {
  mfa_enabled: "MFA ativado",
  mfa_disabled: "MFA desativado",
  mfa_reset_requested: "Reset de MFA solicitado",
  mfa_reset_executed: "Reset de MFA executado",
  mfa_reset_canceled: "Reset de MFA cancelado",
  email_change_requested: "Troca de e-mail solicitada",
  email_changed: "E-mail trocado",
  email_change_reverted: "Troca de e-mail revertida",
  account_deleted: "Conta excluída",
  invite_accepted: "Convite aceito",
  team_left: "Saída de time",
  impersonate_started: "Impersonate iniciado",
  session_revoked: "Sessão encerrada",
};

export default function AuditoriaPage() {
  const [page, setPage] = useState(1);
  const [event, setEvent] = useState<string>("todos");
  const [email, setEmail] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const consulta = api.admin.listAuditLogs.useQuery({
    page,
    event: event === "todos" ? undefined : event,
    email: email.trim() || undefined,
  });

  const totalPaginas = consulta.data
    ? Math.max(1, Math.ceil(consulta.data.total / consulta.data.porPagina))
    : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={event}
          onValueChange={(v) => {
            setEvent(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os eventos</SelectItem>
            {AUDIT_EVENTS.map((e) => (
              <SelectItem key={e} value={e}>
                {ROTULOS[e] ?? e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          className="w-[260px]"
          placeholder="Filtrar por e-mail"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Alvo</TableHead>
            <TableHead>Ator</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(consulta.data?.logs ?? []).map((log) => {
            const destrutivo = (
              AUDIT_EVENTOS_DESTRUTIVOS as string[]
            ).includes(log.event);

            return (
              <>
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() =>
                    setExpandido(expandido === log.id ? null : log.id)
                  }
                >
                  <TableCell className="whitespace-nowrap">
                    {format(log.createdAt, "dd/MM/yyyy, 'às' HH'h'mm")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={destrutivo ? "destructive" : "secondary"}>
                      {ROTULOS[log.event] ?? log.event}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {/* E-mail some depois da pseudonimização; o subject fica. */}
                    {log.targetEmail ?? log.targetSubject ?? "—"}
                  </TableCell>
                  <TableCell>{log.actorEmail ?? "sistema"}</TableCell>
                  <TableCell>{log.ip ?? "—"}</TableCell>
                </TableRow>
                {expandido === log.id && log.metadata ? (
                  <TableRow key={`${log.id}-meta`}>
                    <TableCell colSpan={5}>
                      <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ) : null}
              </>
            );
          })}
          {!consulta.isLoading && (consulta.data?.logs ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Nenhum evento no filtro atual.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <div className="flex items-center gap-3 text-sm">
        <Button
          size="sm"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </Button>
        <span className="text-muted-foreground">
          Página {page} de {totalPaginas}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={page >= totalPaginas}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
