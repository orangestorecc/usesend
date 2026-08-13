"use client";

import Link from "next/link";
import { H1 } from "@usesend/ui";
import { Button } from "@usesend/ui/src/button";
import { format } from "date-fns";
import {
  CheckCircle2Icon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { api } from "~/trpc/react";
import { ReputationGauge } from "./reputation-gauge";

const ESTADO_ROTULO: Record<string, string> = {
  HEALTHY: "Saudável",
  WARNING: "Atenção",
  CRITICAL: "Crítico",
  BLOCKED: "Envios pausados",
  SUPERVISED: "Envio assistido",
  EXEMPT: "Acompanhamento manual",
};

const PLANO_DE_ACAO = [
  {
    titulo: "Remova os endereços que já retornaram",
    texto:
      "Cada endereço que retorna definitivamente vai para a lista de supressões. Tire-os também da sua origem de contatos, senão eles voltam na próxima importação.",
    href: "/suppressions",
    cta: "Ver supressões",
  },
  {
    titulo: "Ative a confirmação de cadastro (double opt-in)",
    texto:
      "Com a confirmação por e-mail, endereços digitados errado nunca entram na lista. É a medida que mais derruba a taxa no médio prazo.",
    href: "/contacts",
    cta: "Configurar nas listas",
  },
  {
    titulo: "Revise a origem dos contatos mais recentes",
    texto:
      "Listas compradas ou importadas de terceiros são a causa mais comum de pico de retorno — e são proibidas pela Política de Uso Aceitável.",
    href: "/contacts",
    cta: "Ver listas",
  },
  {
    titulo: "Reduza a cadência enquanto a taxa não cai",
    texto:
      "Enviar menos por dia dá tempo de identificar o problema sem queimar a reputação do seu domínio.",
    href: "/campaigns",
    cta: "Ver campanhas",
  },
];

export default function ReputationPage() {
  const { data: status, isLoading } = api.reputation.status.useQuery();
  const { data: breakdown } = api.reputation.breakdown.useQuery({ days: 30 });
  const { data: events } = api.reputation.events.useQuery({ limit: 20 });
  const { data: recentBounces } = api.reputation.recentBounces.useQuery({
    limit: 20,
  });

  if (isLoading || !status) {
    return (
      <div>
        <H1>Entregabilidade</H1>
        <div className="mt-10 h-40 animate-pulse rounded-xl border bg-muted/30" />
      </div>
    );
  }

  const bloqueado = status.state === "BLOCKED";
  const Icone =
    status.state === "HEALTHY"
      ? CheckCircle2Icon
      : bloqueado
        ? OctagonAlertIcon
        : TriangleAlertIcon;

  const corDoEstado =
    status.state === "HEALTHY"
      ? "text-success"
      : status.state === "WARNING"
        ? "text-warning"
        : "text-destructive";

  return (
    <div className="pb-16">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <H1>Entregabilidade</H1>
        <Link href="/suppressions">
          <Button variant="outline">Lista de supressões</Button>
        </Link>
      </div>

      {/* Estado atual */}
      <section className="rounded-xl border p-6 shadow">
        <div className="flex flex-wrap items-baseline gap-4">
          <div className="font-mono text-4xl">
            {status.bounceRate.toFixed(2)}%
          </div>
          <div className={`flex items-center gap-1.5 text-sm ${corDoEstado}`}>
            <Icone className="h-4 w-4" aria-hidden />
            {ESTADO_ROTULO[status.state] ?? status.state}
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Taxa de retorno definitivo (hard bounce) dos últimos{" "}
          {status.windowDays} dias, sobre{" "}
          {status.sampleSize.toLocaleString("pt-BR")} entregas com resposta.
        </p>

        {!status.sampleSufficient ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Amostra pequena: com esse volume a taxa ainda oscila muito, e por
            isso <strong>nenhum bloqueio é aplicado</strong>.
          </p>
        ) : bloqueado ? (
          <p className="mt-2 text-sm text-destructive">
            Seus envios estão pausados. Assim que a taxa cair abaixo de{" "}
            {status.thresholds.block}% com envios novos saudáveis, a liberação
            volta automaticamente.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Faltam{" "}
            <strong>{status.distanceToBlock.toFixed(2)} ponto(s)</strong>{" "}
            percentuais para o limite de pausa automática (
            {status.thresholds.block}%).
          </p>
        )}

        <div className="mt-6">
          <ReputationGauge
            value={status.bounceRate}
            warning={status.thresholds.warning}
            critical={status.thresholds.critical}
            block={status.thresholds.block}
          />
        </div>

        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-muted-foreground">Entregues</div>
            <div className="font-mono">
              {status.delivered.toLocaleString("pt-BR")}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Retornos definitivos</div>
            <div className="font-mono">
              {status.hardBounced.toLocaleString("pt-BR")}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Últimas 1.000 mensagens</div>
            <div className="font-mono">
              {status.shortWindowBounceRate.toFixed(2)}%
            </div>
          </div>
        </div>
      </section>

      {/* Por que isso importa */}
      <section className="mt-8 rounded-xl border p-6">
        <h2 className="font-mono text-muted-foreground">Por que isso importa</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Quando muitos e-mails voltam porque o endereço não existe, os
          provedores (Gmail, Outlook e afins) passam a tratar todo o seu envio
          como suspeito — inclusive os e-mails que importam, como confirmação de
          pedido e recuperação de senha. Manter a taxa baixa é o que garante que
          suas mensagens cheguem à caixa de entrada.
        </p>
      </section>

      {/* Plano de ação */}
      <section className="mt-8">
        <h2 className="mb-4 font-mono text-muted-foreground">Plano de ação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANO_DE_ACAO.map((passo, indice) => (
            <div key={passo.titulo} className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-mono">
                  {indice + 1}
                </span>
                <div>
                  <div className="font-medium">{passo.titulo}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {passo.texto}
                  </p>
                  <Link
                    href={passo.href}
                    className="mt-2 inline-block text-sm underline"
                  >
                    {passo.cta}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top ofensores */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="font-mono text-muted-foreground">
            Domínios que mais retornam
          </h2>
          {breakdown && breakdown.byDomain.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {breakdown.byDomain.map((linha) => (
                <li key={linha.key} className="flex justify-between gap-4">
                  <span className="truncate">{linha.key}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {linha.count} ({linha.share.toFixed(0)}%)
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum retorno definitivo nos últimos 30 dias.
            </p>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-mono text-muted-foreground">
            Motivos dos retornos
          </h2>
          {breakdown && breakdown.byReason.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {breakdown.byReason.map((linha) => (
                <li key={linha.key} className="flex justify-between gap-4">
                  <span className="truncate">{linha.key}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {linha.count} ({linha.share.toFixed(0)}%)
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nada a mostrar por enquanto.
            </p>
          )}
        </div>
      </section>

      {/* Endereços recentes */}
      {recentBounces && recentBounces.length > 0 ? (
        <section className="mt-8 rounded-xl border p-4">
          <h2 className="font-mono text-muted-foreground">
            Últimos endereços que retornaram
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {recentBounces.map((linha) => (
              <li
                key={linha.email}
                className="flex justify-between gap-4 text-muted-foreground"
              >
                <span className="truncate text-foreground">{linha.email}</span>
                <span className="shrink-0 font-mono">
                  {format(linha.createdAt, "dd/MM/yyyy")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Histórico */}
      {events && events.length > 0 ? (
        <section className="mt-8 rounded-xl border p-4">
          <h2 className="font-mono text-muted-foreground">
            Histórico de entregabilidade
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {events.map((evento) => (
              <li key={evento.id} className="flex flex-wrap gap-x-3">
                <span className="font-mono text-muted-foreground">
                  {format(evento.createdAt, "dd/MM/yyyy HH:mm")}
                </span>
                <span>
                  {ESTADO_ROTULO[evento.fromState] ?? evento.fromState} →{" "}
                  <strong>
                    {ESTADO_ROTULO[evento.toState] ?? evento.toState}
                  </strong>
                </span>
                <span className="text-muted-foreground">
                  ({evento.bounceRate.toFixed(2)}%)
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
