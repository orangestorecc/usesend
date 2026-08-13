"use client";

import Link from "next/link";
import { OctagonAlertIcon, TriangleAlertIcon } from "lucide-react";
import { api } from "~/trpc/react";

/**
 * Aviso persistente de reputação no topo do dashboard.
 * Tom de parceria, nunca punitivo: diz o número, o que continua funcionando e
 * qual é o caminho de volta (docs-spec/BOUNCE-CONTROL-SPEC.md §4).
 */
export function ReputationBanner() {
  const { data } = api.reputation.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  if (!data) return null;
  if (data.state === "HEALTHY" || data.state === "WARNING" || data.state === "EXEMPT") {
    return null;
  }

  const isBlocked = data.state === "BLOCKED";
  const isSupervised = data.state === "SUPERVISED";

  const Icon = isBlocked ? OctagonAlertIcon : TriangleAlertIcon;

  const message = isBlocked
    ? `Envios pausados. Sua taxa de retorno chegou a ${data.bounceRate.toFixed(2)}%, acima do limite de ${data.thresholds.block}%. Seu painel, contatos e relatórios continuam aqui.`
    : isSupervised
      ? `Envios liberados em modo assistido, com limite diário reduzido${
          data.supervisedLimit
            ? ` de ${data.supervisedLimit.toLocaleString("pt-BR")} e-mails`
            : ""
        }.`
      : `Sua taxa de retorno está em ${data.bounceRate.toFixed(2)}%. O limite para pausa automática é ${data.thresholds.block}%.`;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-center text-sm ${
        isBlocked
          ? "bg-destructive/10 text-destructive"
          : "bg-warning/10 text-warning-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
      <Link href="/reputation" className="font-semibold underline">
        {isBlocked ? "Veja como voltar a enviar" : "Ver detalhes"}
      </Link>
    </div>
  );
}
