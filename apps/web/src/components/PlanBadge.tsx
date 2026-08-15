"use client";

import Link from "next/link";
import { api } from "~/trpc/react";

/**
 * Etiqueta do plano, ao lado do logo.
 *
 * Substituiu o "Beta": o selo ficava ali o dia inteiro sem dizer nada de útil,
 * enquanto a pergunta que a pessoa realmente faz olhando o topo do produto é
 * "em que plano eu estou?". Vira também o atalho mais curto para o upgrade.
 *
 * Discrição é requisito: é uma etiqueta ao lado de uma marca, não um botão.
 * Por isso só o nome do plano, em caixa alta pequena — e um ponto âmbar quando
 * há fatura em aberto, que é a única situação em que ela precisa gritar.
 */
export function PlanBadge() {
  const { data } = api.payments.billingState.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Enquanto carrega não mostra nada: um "Free" que pisca e vira "Pro" é pior
  // do que um espaço vazio por meio segundo.
  if (!data) return null;

  const emAtraso = data.isOverdue || Boolean(data.blockedAt);

  return (
    <Link
      href="/settings"
      title={
        emAtraso
          ? `Plano ${data.planName} · fatura em aberto`
          : `Plano ${data.planName} · ver uso e planos`
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
        emAtraso
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
          : data.isPaid
            ? "border-foreground/20 bg-foreground/5 text-foreground/80 hover:bg-foreground/10"
            : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {emAtraso ? (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
      ) : null}
      {data.planName}
    </Link>
  );
}
