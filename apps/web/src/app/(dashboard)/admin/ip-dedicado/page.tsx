"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Spinner } from "@usesend/ui/src/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { toast } from "@usesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { isCloud } from "~/utils/common";

/**
 * Fila de IP dedicado.
 *
 * Substitui o UPDATE manual em produção: o pedido chega aqui pelo mesmo clique
 * que o cliente deu na tela de Uso, e sai daqui em operação. Ativar é o passo
 * que liga a cobrança — por isso ele exige o IP registrado antes.
 */

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  solicitado: { label: "Solicitado", variant: "outline" },
  aquecendo: { label: "Em aquecimento", variant: "secondary" },
  ativo: { label: "Em operação", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const data = (d: Date | string | null) =>
  d ? format(new Date(d), "dd MMM yyyy") : "—";

export default function AdminDedicatedIpPage() {
  const utils = api.useUtils();
  const query = api.dedicatedIpAdmin.list.useQuery(undefined, {
    enabled: isCloud(),
  });
  const [enderecos, setEnderecos] = useState<Record<number, string>>({});

  const aoConcluir = (msg: string) => ({
    onSuccess: () => {
      utils.dedicatedIpAdmin.list.invalidate();
      toast.success(msg);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const warmup = api.dedicatedIpAdmin.startWarmup.useMutation(
    aoConcluir("Aquecimento registrado. O cliente já vê o novo status."),
  );
  const activate = api.dedicatedIpAdmin.activate.useMutation(
    aoConcluir("IP em operação. A cobrança passa a contar a partir de hoje."),
  );
  const release = api.dedicatedIpAdmin.release.useMutation(
    aoConcluir("Add-on encerrado."),
  );

  if (!isCloud()) {
    return (
      <p className="text-sm text-muted-foreground">
        A fila de IP dedicado só existe no ambiente cloud.
      </p>
    );
  }

  const pendente = warmup.isPending || activate.isPending || release.isPending;

  return (
    <div className="rounded-xl border shadow-sm">
      <div className="border-b p-6">
        <h2 className="text-base font-semibold">IP dedicado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos do add-on de R$ 150,00 / mês. A mensalidade só entra na fatura
          depois de &ldquo;Colocar em operação&rdquo;, proporcional aos dias do
          mês.
        </p>
      </div>

      {query.isLoading ? (
        <div className="p-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : !query.data?.length ? (
        <p className="p-6 text-sm text-muted-foreground">
          Nenhum pedido de IP dedicado no momento.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>IP</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((t) => {
              const s = STATUS[t.status] ?? STATUS.solicitado!;
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      #{t.id} · {t.planKey}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.variant}>{s.label}</Badge>
                    {t.status === "aquecendo" ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        desde {data(t.dedicatedIpWarmupStartedAt)}
                      </div>
                    ) : t.status === "ativo" ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        desde {data(t.dedicatedIpActiveAt)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {data(t.dedicatedIpRequestedAt)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {t.dedicatedIpAddress ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {t.status === "solicitado" ? (
                        <>
                          <Input
                            className="h-8 w-36 font-mono text-xs"
                            placeholder="203.0.113.10"
                            value={enderecos[t.id] ?? ""}
                            onChange={(e) =>
                              setEnderecos((p) => ({
                                ...p,
                                [t.id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            disabled={pendente || !enderecos[t.id]}
                            onClick={() =>
                              warmup.mutate({
                                teamId: t.id,
                                address: (enderecos[t.id] ?? "").trim(),
                              })
                            }
                          >
                            Iniciar aquecimento
                          </Button>
                        </>
                      ) : t.status === "aquecendo" ? (
                        <Button
                          size="sm"
                          disabled={pendente}
                          onClick={() => activate.mutate({ teamId: t.id })}
                        >
                          Colocar em operação
                        </Button>
                      ) : null}

                      {t.status === "cancelado" ? null : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendente}
                          onClick={() => release.mutate({ teamId: t.id })}
                        >
                          {t.status === "ativo" ? "Encerrar" : "Recusar"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
