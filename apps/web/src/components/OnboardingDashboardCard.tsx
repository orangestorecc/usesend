"use client";

import { Button } from "@usesend/ui/src/button";
import { Progress } from "@usesend/ui/src/progress";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";

const RESUMO: Record<string, string> = {
  DOMAIN_CREATED: "Cadastrar seu domínio",
  DOMAIN_VERIFIED: "Validar o domínio",
  LIST_CREATED: "Criar sua primeira lista",
  CONTACTS_ADDED: "Adicionar contatos",
  CAMPAIGN_SENT: "Disparar a primeira campanha",
};

/**
 * Enquanto a conta nao esta configurada, o painel de metricas nao tem o que
 * mostrar — este card ocupa esse espaco com o que falta fazer.
 */
export function OnboardingDashboardCard() {
  const progressoQuery = api.onboarding.getProgress.useQuery();
  const progresso = progressoQuery.data;

  if (!progresso || progresso.isComplete) {
    return null;
  }

  const percentual = Math.round(
    (progresso.completedCount / progresso.totalCount) * 100,
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Termine de configurar sua conta</h2>
          <p className="text-sm text-muted-foreground">
            Faltam {progresso.totalCount - progresso.completedCount} passos para
            você enviar sua primeira campanha.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/onboarding">Continuar</Link>
        </Button>
      </div>

      <Progress value={percentual} className="h-2" />

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {progresso.steps.map(({ step, completed }) => (
          <div
            key={step}
            className={`flex items-center gap-2 text-sm ${
              completed ? "text-muted-foreground" : ""
            }`}
          >
            {completed ? (
              <CheckCircle2 className="h-4 w-4 text-green" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            {RESUMO[step] ?? step}
          </div>
        ))}
      </div>
    </div>
  );
}
