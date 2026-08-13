"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Badge } from "@usesend/ui/src/badge";
import { Switch } from "@usesend/ui/src/switch";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
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
import { TeamReputationSheet } from "./team-sheet";

const ESTADOS = [
  "HEALTHY",
  "WARNING",
  "CRITICAL",
  "BLOCKED",
  "SUPERVISED",
  "EXEMPT",
] as const;

const ROTULOS: Record<string, string> = {
  HEALTHY: "Saudável",
  WARNING: "Atenção",
  CRITICAL: "Crítico",
  BLOCKED: "Bloqueado",
  SUPERVISED: "Assistido",
  EXEMPT: "Isento",
};

type CampoRegua =
  | "windowDays"
  | "shortWindowSize"
  | "minVolume"
  | "minBounces"
  | "warningRate"
  | "criticalRate"
  | "blockRate"
  | "unblockRate"
  | "minRecoveryVolume"
  | "supervisedLimit";

const CAMPOS: { chave: CampoRegua; rotulo: string; passo?: string }[] = [
  { chave: "windowDays", rotulo: "Janela (dias)" },
  { chave: "shortWindowSize", rotulo: "Janela curta (mensagens)" },
  { chave: "minVolume", rotulo: "Volume mínimo (entregas)" },
  { chave: "minBounces", rotulo: "Retornos mínimos" },
  { chave: "warningRate", rotulo: "Alerta (%)", passo: "0.1" },
  { chave: "criticalRate", rotulo: "Crítico (%)", passo: "0.1" },
  { chave: "blockRate", rotulo: "Bloqueio (%)", passo: "0.1" },
  { chave: "unblockRate", rotulo: "Desbloqueio (%)", passo: "0.1" },
  { chave: "minRecoveryVolume", rotulo: "Volume de recuperação" },
  { chave: "supervisedLimit", rotulo: "Teto do modo assistido" },
];

export default function AdminReputationPage() {
  const [filtro, setFiltro] = useState<string | undefined>(undefined);
  const [timeAberto, setTimeAberto] = useState<number | null>(null);

  const utils = api.useUtils();
  const { data: politica, isLoading: carregandoPolitica } =
    api.reputation.adminPolicy.useQuery();
  const { data: times, isLoading: carregandoTimes } =
    api.reputation.adminTeamsAtRisk.useQuery({
      state: filtro as (typeof ESTADOS)[number] | undefined,
      limit: 100,
    });

  const [rascunho, setRascunho] = useState<Record<string, number> | null>(null);
  const [autoBlock, setAutoBlock] = useState<boolean | null>(null);

  const valores = {
    windowDays: rascunho?.windowDays ?? politica?.windowDays ?? 30,
    shortWindowSize: rascunho?.shortWindowSize ?? politica?.shortWindowSize ?? 1000,
    minVolume: rascunho?.minVolume ?? politica?.minVolume ?? 500,
    minBounces: rascunho?.minBounces ?? politica?.minBounces ?? 10,
    warningRate: rascunho?.warningRate ?? Number(politica?.warningRate ?? 0.4),
    criticalRate: rascunho?.criticalRate ?? Number(politica?.criticalRate ?? 1),
    blockRate: rascunho?.blockRate ?? Number(politica?.blockRate ?? 2),
    unblockRate: rascunho?.unblockRate ?? Number(politica?.unblockRate ?? 1.2),
    minRecoveryVolume:
      rascunho?.minRecoveryVolume ?? politica?.minRecoveryVolume ?? 200,
    supervisedLimit: rascunho?.supervisedLimit ?? politica?.supervisedLimit ?? 500,
  };

  const ligado = autoBlock ?? politica?.autoBlock ?? false;

  // Preview de impacto: nenhuma régua é salva às cegas.
  const { data: preview } = api.reputation.adminPolicyPreview.useQuery({
    blockRate: valores.blockRate,
    minVolume: valores.minVolume,
    minBounces: valores.minBounces,
  });

  const salvar = api.reputation.adminUpdatePolicy.useMutation({
    onSuccess: () => {
      toast.success("Régua atualizada");
      setRascunho(null);
      setAutoBlock(null);
      void utils.reputation.adminPolicy.invalidate();
      void utils.reputation.adminTeamsAtRisk.invalidate();
    },
    onError: (erro) => toast.error(erro.message),
  });

  if (carregandoPolitica) {
    return <Spinner className="h-6 w-6" />;
  }

  return (
    <div className="space-y-10">
      {/* Régua */}
      <section className="rounded-xl border p-6">
        <h2 className="font-semibold">Régua de reputação</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vale para todos os times, salvo override individual. A faixa acordada é
          de {valores.warningRate}% a {valores.blockRate}%.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CAMPOS.map((campo) => (
            <label key={campo.chave} className="text-sm">
              <span className="text-muted-foreground">{campo.rotulo}</span>
              <Input
                type="number"
                step={campo.passo ?? "1"}
                className="mt-1"
                value={valores[campo.chave]}
                onChange={(evento) =>
                  setRascunho((atual) => ({
                    ...(atual ?? {}),
                    [campo.chave]: Number(evento.target.value),
                  }))
                }
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={ligado}
              onCheckedChange={(valor) => setAutoBlock(valor)}
            />
            Bloqueio automático ligado
          </label>
          {!ligado ? (
            <Badge variant="outline">
              Shadow mode: a engine mede e alerta, mas não bloqueia
            </Badge>
          ) : null}
        </div>

        {preview ? (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
            Com esta régua, <strong>{preview.wouldBlock}</strong> de{" "}
            {preview.totalTeams} times entrariam em bloqueio hoje.
            {preview.wouldBlock > 0 && preview.totalTeams > 0
              ? ` (${((preview.wouldBlock / preview.totalTeams) * 100).toFixed(1)}% da base.)`
              : null}
          </div>
        ) : null}

        <Button
          className="mt-6"
          disabled={salvar.isPending}
          onClick={() =>
            salvar.mutate({
              ...valores,
              autoBlock: ligado,
            })
          }
        >
          {salvar.isPending ? "Salvando..." : "Salvar régua"}
        </Button>
      </section>

      {/* Times */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Times por taxa de retorno</h2>
          <div className="ml-auto flex gap-1">
            <Button
              variant={filtro ? "outline" : "secondary"}
              size="sm"
              onClick={() => setFiltro(undefined)}
            >
              Todos
            </Button>
            {ESTADOS.map((estado) => (
              <Button
                key={estado}
                variant={filtro === estado ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFiltro(estado)}
              >
                {ROTULOS[estado]}
              </Button>
            ))}
          </div>
        </div>

        {carregandoTimes ? (
          <Spinner className="h-6 w-6" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Taxa 30d</TableHead>
                <TableHead>Amostra</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Avaliado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {times?.length ? (
                times.map((time) => (
                  <TableRow key={time.teamId}>
                    <TableCell>
                      {time.teamName}{" "}
                      <span className="text-muted-foreground">
                        #{time.teamId}
                      </span>
                    </TableCell>
                    <TableCell>{time.plan}</TableCell>
                    <TableCell className="font-mono">
                      {time.bounceRate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="font-mono">
                      {time.sampleSize.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          time.state === "BLOCKED" ? "destructive" : "outline"
                        }
                      >
                        {ROTULOS[time.state] ?? time.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(time.lastEvaluatedAt, {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTimeAberto(time.teamId)}
                      >
                        Abrir ficha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Nenhum time neste estado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      {timeAberto ? (
        <TeamReputationSheet
          teamId={timeAberto}
          onClose={() => setTimeAberto(null)}
        />
      ) : null}
    </div>
  );
}
