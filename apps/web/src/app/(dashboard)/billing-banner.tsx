"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { api } from "~/trpc/react";

/**
 * Aviso de fatura em aberto no topo do painel.
 *
 * Uma faixa fina, sempre visível, como a do Resend: quem não paga precisa
 * saber disso em qualquer tela, não só em Faturamento. Depois da trava o texto
 * muda de "para evitar" para "seus envios estão pausados" — avisar sobre uma
 * consequência que já aconteceu faz o cliente desconfiar do resto.
 */
export function BillingBanner() {
  const { data } = api.payments.billingState.useQuery(undefined, {
    // Não é um dado que muda a cada navegação; refazer a consulta em toda
    // página só somaria latência ao carregamento.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!data?.invoice || !data.isPaid) return null;

  const travado = Boolean(data.blockedAt);
  const valor = (data.invoice.amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  if (!data.isOverdue) return null;

  const texto = travado
    ? `Seus envios estão pausados por causa da fatura ${data.invoice.number} (${valor}) em aberto. Pague para voltar a enviar agora mesmo.`
    : data.hoursUntilBlock !== null && data.hoursUntilBlock <= 24
      ? `Você tem uma fatura em aberto de ${valor}. Para evitar a pausa dos envios em ${data.hoursUntilBlock}h, pague a fatura ${data.invoice.number}.`
      : `Você tem uma fatura em aberto de ${valor}. Para evitar a interrupção dos envios, pague a fatura ${data.invoice.number}.`;

  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 px-4 py-2 text-center text-sm ${
        travado
          ? "bg-destructive/15 text-destructive"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{texto}</span>
      <Link href="/settings/billing" className="font-semibold underline">
        Pagar agora
      </Link>
    </div>
  );
}
