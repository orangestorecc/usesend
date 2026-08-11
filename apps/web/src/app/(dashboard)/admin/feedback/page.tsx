"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2 } from "lucide-react";

import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Textarea } from "@usesend/ui/src/textarea";
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
import { toast } from "@usesend/ui/src/toaster";
import Spinner from "@usesend/ui/src/spinner";

import { api } from "~/trpc/react";

const STATUS = ["NEW", "IN_REVIEW", "DONE", "ARCHIVED"] as const;
type Status = (typeof STATUS)[number];

const STATUS_LABEL: Record<Status, string> = {
  NEW: "Novo",
  IN_REVIEW: "Em análise",
  DONE: "Resolvido",
  ARCHIVED: "Arquivado",
};

const STATUS_VARIANT: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  NEW: "default",
  IN_REVIEW: "secondary",
  DONE: "outline",
  ARCHIVED: "outline",
};

export default function AdminFeedbackPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [openNote, setOpenNote] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const utils = api.useUtils();

  const { data, isLoading } = api.feedback.list.useQuery({
    page,
    status: status === "ALL" ? undefined : status,
    search: search || undefined,
  });

  const invalidate = () => void utils.feedback.list.invalidate();

  const updateStatus = api.feedback.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateNote = api.feedback.updateNote.useMutation({
    onSuccess: () => {
      toast.success("Nota salva");
      setOpenNote(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteFeedback = api.feedback.delete.useMutation({
    onSuccess: () => {
      toast.success("Feedback excluído");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const feedbacks = data?.feedbacks ?? [];
  const total = data?.total ?? 0;
  const perPage = data?.perPage ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Feedback</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo que os clientes enviaram, com data, hora, autor e empresa.
        </p>
      </div>

      {/* Resumo por status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(status === s ? "ALL" : s);
              setPage(1);
            }}
            className={`rounded-lg border p-3 text-left transition hover:bg-accent ${
              status === s ? "border-primary" : ""
            }`}
          >
            <div className="text-xs text-muted-foreground">
              {STATUS_LABEL[s]}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {data?.counts?.[s] ?? 0}
            </div>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por mensagem, pessoa ou empresa"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applySearch();
          }}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={applySearch}>
          Buscar
        </Button>
        {status !== "ALL" || search ? (
          <Button
            variant="ghost"
            onClick={() => {
              setStatus("ALL");
              setSearch("");
              setSearchInput("");
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
        <span className="ml-auto text-sm text-muted-foreground">
          {total} {total === 1 ? "registro" : "registros"}
        </span>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Quando</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="w-[200px]">Cliente</TableHead>
              <TableHead className="w-[210px]">Quem escreveu</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <Spinner className="mx-auto h-5 w-5" />
                </TableCell>
              </TableRow>
            ) : feedbacks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum feedback por aqui ainda.
                </TableCell>
              </TableRow>
            ) : (
              feedbacks.map((f) => {
                const created = new Date(f.createdAt);
                return (
                  <TableRow key={f.id} className="align-top">
                    <TableCell className="text-xs">
                      <div>{format(created, "dd/MM/yyyy HH:mm")}</div>
                      <div className="text-muted-foreground">
                        {formatDistanceToNow(created, {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </div>
                    </TableCell>

                    <TableCell className="max-w-md">
                      <p className="whitespace-pre-wrap text-sm">{f.message}</p>

                      {openNote === f.id ? (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Nota interna (só o time vê)"
                            className="min-h-[80px]"
                            maxLength={2000}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                updateNote.mutate({
                                  id: f.id,
                                  note: noteDraft.trim() || null,
                                })
                              }
                              disabled={updateNote.isPending}
                            >
                              Salvar nota
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setOpenNote(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          {f.note ? (
                            <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                              <span className="font-medium">Nota:</span>{" "}
                              {f.note}
                            </p>
                          ) : null}
                          <button
                            className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            onClick={() => {
                              setOpenNote(f.id);
                              setNoteDraft(f.note ?? "");
                            }}
                          >
                            {f.note ? "Editar nota" : "Adicionar nota"}
                          </button>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-sm">
                      <div className="font-medium">
                        {f.team?.name ?? f.teamName ?? "—"}
                      </div>
                      {f.team ? (
                        <div className="text-xs text-muted-foreground">
                          ID {f.team.id} · {f.team.plan}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          time removido
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-sm">
                      <div>{f.user?.name ?? f.userName ?? "—"}</div>
                      <div className="break-all text-xs text-muted-foreground">
                        {f.user?.email ?? f.userEmail ?? "—"}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={f.status}
                        onValueChange={(v) =>
                          updateStatus.mutate({
                            id: f.id,
                            status: v as Status,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue>
                            <Badge
                              variant={STATUS_VARIANT[f.status as Status]}
                              className="font-normal"
                            >
                              {STATUS_LABEL[f.status as Status]}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Excluir feedback"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Excluir este feedback? Não dá para desfazer.",
                            )
                          ) {
                            deleteFeedback.mutate({ id: f.id });
                          }
                        }}
                        disabled={deleteFeedback.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
