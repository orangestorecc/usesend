"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Badge } from "@usesend/ui/src/badge";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
import { format } from "date-fns";
import { api } from "~/trpc/react";

type Acao = "block" | "unblock" | "supervise" | "exempt";

const ACOES: { chave: Acao; rotulo: string; destrutiva?: boolean }[] = [
  { chave: "block", rotulo: "Bloquear envios", destrutiva: true },
  { chave: "unblock", rotulo: "Desbloquear" },
  { chave: "supervise", rotulo: "Liberar assistido" },
  { chave: "exempt", rotulo: "Isentar" },
];

/**
 * Ficha de reputação do time. Toda ação exige motivo (mín. 10 caracteres) —
 * é ele que vira a trilha de auditoria e a explicação para o cliente.
 */
export function TeamReputationSheet({
  teamId,
  onClose,
}: {
  teamId: number;
  onClose: () => void;
}) {
  const [acao, setAcao] = useState<Acao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [tetoDiario, setTetoDiario] = useState<number | "">("");
  const [dias, setDias] = useState<number | "">("");

  const utils = api.useUtils();
  const { data, isLoading } = api.reputation.adminTeamDetail.useQuery({ teamId });

  const aoConcluir = (mensagem: string) => {
    toast.success(mensagem);
    setAcao(null);
    setMotivo("");
    void utils.reputation.adminTeamDetail.invalidate({ teamId });
    void utils.reputation.adminTeamsAtRisk.invalidate();
  };

  const aoFalhar = (erro: { message: string }) => toast.error(erro.message);

  const bloquear = api.reputation.adminBlock.useMutation({
    onSuccess: () => aoConcluir("Envios bloqueados"),
    onError: aoFalhar,
  });
  const desbloquear = api.reputation.adminUnblock.useMutation({
    onSuccess: () => aoConcluir("Envios liberados"),
    onError: aoFalhar,
  });
  const supervisionar = api.reputation.adminSupervise.useMutation({
    onSuccess: () => aoConcluir("Liberação assistida concedida"),
    onError: aoFalhar,
  });
  const isentar = api.reputation.adminExempt.useMutation({
    onSuccess: () => aoConcluir("Time isentado"),
    onError: aoFalhar,
  });

  const executando =
    bloquear.isPending ||
    desbloquear.isPending ||
    supervisionar.isPending ||
    isentar.isPending;

  const confirmar = () => {
    if (motivo.trim().length < 10) {
      toast.error("Descreva o motivo com pelo menos 10 caracteres");
      return;
    }
    const base = { teamId, reason: motivo.trim() };
    if (acao === "block") bloquear.mutate(base);
    if (acao === "unblock") desbloquear.mutate(base);
    if (acao === "supervise")
      supervisionar.mutate({
        ...base,
        dailyLimit: tetoDiario === "" ? undefined : Number(tetoDiario),
        days: dias === "" ? undefined : Number(dias),
      });
    if (acao === "exempt")
      isentar.mutate({ ...base, days: dias === "" ? undefined : Number(dias) });
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reputação do time #{teamId}</DialogTitle>
          <DialogDescription>
            Janela de {data?.status.snapshot.windowDays ?? 30} dias. Toda ação
            aqui exige motivo e fica registrada na auditoria.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <Spinner className="h-6 w-6" />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-baseline gap-4">
              <div className="font-mono text-3xl">
                {data.status.snapshot.bounceRate.toFixed(2)}%
              </div>
              <Badge
                variant={
                  data.status.state === "BLOCKED" ? "destructive" : "outline"
                }
              >
                {data.status.state}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {data.status.snapshot.sampleSize.toLocaleString("pt-BR")}{" "}
                entregas · janela curta{" "}
                {data.status.snapshot.shortWindow.bounceRate.toFixed(2)}%
                {data.status.snapshot.sampleSufficient
                  ? ""
                  : " · amostra insuficiente"}
              </span>
            </div>

            {data.status.blockedReason ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <strong>Motivo do bloqueio:</strong> {data.status.blockedReason}
              </div>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium">Domínios que retornam</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {data.breakdown.byDomain.length ? (
                    data.breakdown.byDomain.map((linha) => (
                      <li key={linha.key} className="flex justify-between gap-4">
                        <span className="truncate">{linha.key}</span>
                        <span className="font-mono">{linha.count}</span>
                      </li>
                    ))
                  ) : (
                    <li>Sem retornos na janela.</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium">Motivos</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {data.breakdown.byReason.length ? (
                    data.breakdown.byReason.map((linha) => (
                      <li key={linha.key} className="flex justify-between gap-4">
                        <span className="truncate">{linha.key}</span>
                        <span className="font-mono">{linha.count}</span>
                      </li>
                    ))
                  ) : (
                    <li>Sem retornos na janela.</li>
                  )}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium">Histórico</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {data.events.length ? (
                  data.events.map((evento) => (
                    <li key={evento.id} className="flex flex-wrap gap-x-2">
                      <span className="font-mono">
                        {format(evento.createdAt, "dd/MM/yy HH:mm")}
                      </span>
                      <span>
                        {evento.fromState} → <strong>{evento.toState}</strong>
                      </span>
                      <span>({evento.bounceRate.toFixed(2)}%)</span>
                      <span>· {evento.actor}</span>
                      {evento.reason ? <span>· {evento.reason}</span> : null}
                    </li>
                  ))
                ) : (
                  <li>Sem transições registradas.</li>
                )}
              </ul>
            </div>

            {/* Ações */}
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap gap-2">
                {ACOES.map((item) => (
                  <Button
                    key={item.chave}
                    size="sm"
                    variant={
                      acao === item.chave
                        ? item.destrutiva
                          ? "destructive"
                          : "secondary"
                        : "outline"
                    }
                    onClick={() => setAcao(item.chave)}
                  >
                    {item.rotulo}
                  </Button>
                ))}
              </div>

              {acao ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="text-muted-foreground">
                      Motivo (obrigatório, mín. 10 caracteres)
                    </span>
                    <Input
                      className="mt-1"
                      value={motivo}
                      onChange={(evento) => setMotivo(evento.target.value)}
                      placeholder="Ex.: cliente importou lista comprada; combinado com o suporte em 13/08"
                    />
                  </label>

                  {acao === "supervise" ? (
                    <div className="flex flex-wrap gap-3">
                      <label className="text-sm">
                        <span className="text-muted-foreground">
                          Teto diário
                        </span>
                        <Input
                          className="mt-1 w-40"
                          type="number"
                          value={tetoDiario}
                          placeholder="500"
                          onChange={(evento) =>
                            setTetoDiario(
                              evento.target.value === ""
                                ? ""
                                : Number(evento.target.value),
                            )
                          }
                        />
                      </label>
                      <label className="text-sm">
                        <span className="text-muted-foreground">Dias</span>
                        <Input
                          className="mt-1 w-28"
                          type="number"
                          value={dias}
                          placeholder="7"
                          onChange={(evento) =>
                            setDias(
                              evento.target.value === ""
                                ? ""
                                : Number(evento.target.value),
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  {acao === "exempt" ? (
                    <label className="block text-sm">
                      <span className="text-muted-foreground">
                        Validade em dias (vazio = sem prazo)
                      </span>
                      <Input
                        className="mt-1 w-28"
                        type="number"
                        value={dias}
                        onChange={(evento) =>
                          setDias(
                            evento.target.value === ""
                              ? ""
                              : Number(evento.target.value),
                          )
                        }
                      />
                    </label>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={acao === "block" ? "destructive" : "default"}
                      disabled={executando}
                      onClick={confirmar}
                    >
                      {executando ? "Aplicando..." : "Confirmar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAcao(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
