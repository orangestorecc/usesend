"use client";

import { api } from "~/trpc/react";
import { toast } from "@usesend/ui/src/toaster";

import { INVITE_TTL_DIAS } from "~/lib/invites";

export function linkDoConvite(inviteId: string) {
  return `${location.origin}/join-team?inviteId=${inviteId}`;
}

/**
 * Reenvio e cópia do convite pendente.
 *
 * O "copiar link" vivia escondido atrás de self-hosted. Não faz sentido: o link
 * é o mesmo que vai no e-mail, e quando o e-mail some numa caixa de spam o
 * administrador precisa de um plano B em vez de ficar reenviando no escuro.
 */
export function useReenviarConvite(invite: {
  id: string;
  email: string;
  /** Convite vencido não tem link para copiar — só reenvio. */
  expirado?: boolean;
}) {
  const utils = api.useUtils();
  const reenviarMutation = api.team.resendTeamInvite.useMutation();

  function reenviar() {
    reenviarMutation.mutate(
      { inviteId: invite.id },
      {
        onSuccess: () => {
          void utils.team.getTeamInvites.invalidate();
          toast.success(
            `Convite reenviado para ${invite.email}. Vale por ${INVITE_TTL_DIAS} dias a partir de agora.`,
          );
        },
        onError: (error) => {
          toast.error(error.message || "Não foi possível reenviar o convite.");
        },
      },
    );
  }

  async function copiarLink() {
    // Copiar um link morto e mostrar "copiado com sucesso" faz o administrador
    // mandar para o cliente um link que só vai dar erro do outro lado.
    if (invite.expirado) {
      toast.error(
        "Este convite expirou — o link não funciona mais. Use “Reenviar convite” para gerar um prazo novo.",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(linkDoConvite(invite.id));
      toast.success(
        `Link do convite copiado. Ele dá acesso a este workspace — mande só para ${invite.email}.`,
      );
    } catch {
      toast.error(
        "Seu navegador bloqueou a cópia. Libere o acesso à área de transferência e tente de novo.",
      );
    }
  }

  return { reenviar, copiarLink, reenviando: reenviarMutation.isPending };
}
