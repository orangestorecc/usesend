"use client";

import { Button } from "@usesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { api } from "~/trpc/react";
import { toast } from "@usesend/ui/src/toaster";
import { Role } from "@prisma/client";

/** Diálogo puramente controlado: quem abre é o menu de ações do membro. */
export const DeleteTeamMember: React.FC<{
  teamUser: { userId: string; role: Role; email: string };
  self: boolean;
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
}> = ({ teamUser, self, open, onOpenChange }) => {
  const setOpen = onOpenChange;
  const deleteTeamUserMutation = api.team.deleteTeamUser.useMutation();

  const utils = api.useUtils();

  async function onTeamUserDelete() {
    deleteTeamUserMutation.mutate(
      {
        userId: teamUser.userId,
      },
      {
        onSuccess: async () => {
          utils.team.getTeamUsers.invalidate();
          setOpen(false);
          toast.success(`${teamUser.email} não tem mais acesso a este workspace.`);
        },
        onError: async (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {self ? "Sair deste workspace" : "Remover do workspace"}
          </DialogTitle>
          <DialogDescription>
            {self
              ? "Tem certeza de que deseja sair deste workspace? Você perde o acesso aos dados dele e esta ação não pode ser desfeita."
              : `Tem certeza de que deseja remover ${teamUser.email} deste workspace? Esta ação não pode ser desfeita.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onTeamUserDelete}
            isLoading={deleteTeamUserMutation.isPending}
            className="w-[150px]"
          >
            {self ? "Sair" : "Remover"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTeamMember;
