"use client";

import { Progress } from "@usesend/ui/src/progress";
import { Rocket } from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";

/**
 * Lembrete permanente no sidebar. Some sozinho quando chega a 100% e encolhe
 * para uma linha quando o usuario pediu para nao ser mais lembrado.
 */
export function OnboardingWidget() {
  const progressoQuery = api.onboarding.getProgress.useQuery();
  const progresso = progressoQuery.data;

  if (!progresso || progresso.isComplete) {
    return null;
  }

  const percentual = Math.round(
    (progresso.completedCount / progresso.totalCount) * 100,
  );

  if (progresso.isSnoozed) {
    return (
      <Link
        href="/onboarding"
        className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Rocket className="h-3.5 w-3.5" />
        Configuração {progresso.completedCount}/{progresso.totalCount}
      </Link>
    );
  }

  return (
    <Link
      href="/onboarding"
      className="mx-2 mb-2 flex flex-col gap-2 rounded-lg border bg-background/60 p-3 hover:bg-background"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Configuração da conta</span>
        <span className="text-xs text-muted-foreground">
          {progresso.completedCount}/{progresso.totalCount}
        </span>
      </div>
      <Progress value={percentual} className="h-1.5" />
      <span className="text-xs text-muted-foreground">Continuar →</span>
    </Link>
  );
}
