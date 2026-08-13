"use client";

import { Button } from "@usesend/ui/src/button";
import { Spinner } from "@usesend/ui/src/spinner";
import { api } from "~/trpc/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@usesend/ui/src/toaster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { useState } from "react";
import type { AppRouter } from "~/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";
import { INVITE_BLOQUEADO_POR_LIMITE } from "~/lib/invites";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Invite = NonNullable<
  RouterOutputs["invitation"]["getUserInvites"]
>[number];

export default function JoinTeam({
  showCreateTeam = false,
}: {
  showCreateTeam?: boolean;
}) {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("inviteId");

  const { data: invites, status: invitesStatus } =
    api.invitation.getUserInvites.useQuery({
      inviteId,
    });
  const joinTeamMutation = api.invitation.acceptTeamInvite.useMutation();
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bloqueadoPorLimite, setBloqueadoPorLimite] = useState<string | null>(
    null,
  );

  const utils = api.useUtils();
  const router = useRouter();

  const handleAcceptInvite = (invite: Invite) => {
    setSelectedInvite(invite);
    setDialogOpen(true);
  };

  const confirmAcceptInvite = () => {
    if (!selectedInvite) return;

    joinTeamMutation.mutate(
      {
        inviteId: selectedInvite.id,
      },
      {
        onSuccess: async () => {
          toast.success(`Você entrou em ${selectedInvite.team.name}`);
          await Promise.all([
            utils.invitation.getUserInvites.invalidate(),
            utils.team.getTeams.invalidate(),
          ]);
          setDialogOpen(false);
          router.replace("/dashboard");
        },
        onError: (error) => {
          // Limite do plano não é erro do convidado: em vez de um toast seco
          // que dá a impressão de convite queimado, ele vê o estado de espera
          // — o link continua valendo quando o admin regularizar.
          if (error.message === INVITE_BLOQUEADO_POR_LIMITE) {
            setBloqueadoPorLimite(selectedInvite.team.name);
            setDialogOpen(false);
            return;
          }
          toast.error(`Não foi possível entrar no time: ${error.message}`);
          setDialogOpen(false);
        },
      }
    );
  };

  if (bloqueadoPorLimite) {
    return (
      <div className="mx-auto max-w-md rounded-lg border p-6 text-center">
        <div className="text-base font-medium">
          Aguardando liberação do administrador
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          O time <span className="font-medium">{bloqueadoPorLimite}</span>{" "}
          atingiu o limite de membros do plano. Avisamos quem administra o time;
          assim que houver vaga, você recebe um e-mail e este mesmo link
          funciona.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => setBloqueadoPorLimite(null)}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (!invites?.length) {
    return !showCreateTeam ? (
      <div className="text-center text-xl">Nenhum convite encontrado</div>
    ) : null;
  }

  return (
    <div>
      <div>Você foi convidado para entrar em um time</div>
      <div className="space-y-2 mt-4">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center gap-2 border rounded-lg p-2 px-4 shadow justify-between"
          >
            <div>
              <div className="text-sm">{invite.team.name}</div>
              <div className="flex items-center gap-2">
                <div className="text-muted-foreground text-xs capitalize">
                  {invite.role.toLowerCase()}
                </div>
                <div className="text-muted-foreground text-xs">
                  {invite.createdAt.toLocaleDateString()}
                </div>
              </div>
            </div>
            <Button
              onClick={() => handleAcceptInvite(invite)}
              disabled={joinTeamMutation.isPending}
              size="sm"
              variant="ghost"
            >
              {joinTeamMutation.isPending ? (
                <Spinner className="w-5 h-5" />
              ) : (
                "Aceitar"
              )}
            </Button>
          </div>
        ))}
      </div>
      {showCreateTeam ? (
        <div className="mt-8 text-muted-foreground text-sm font-mono text-center">
          OR
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceitar convite do time</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja entrar em{" "}
              <span className="font-semibold text-foreground">
                {selectedInvite?.team.name}
              </span>
              ? Você será adicionado como{" "}
              <span className="font-semibold text-foreground lowercase">
                {selectedInvite?.role.toLowerCase()}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={joinTeamMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmAcceptInvite}
              disabled={joinTeamMutation.isPending}
            >
              {joinTeamMutation.isPending ? (
                <Spinner className="w-5 h-5" />
              ) : (
                "Aceitar convite"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
