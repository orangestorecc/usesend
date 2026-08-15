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

/** Diálogo puramente controlado: quem abre é o menu de ações do convite. */
export const DeleteTeamInvite: React.FC<{
  invite: { id: string; email: string };
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
}> = ({ invite, open, onOpenChange }) => {
  const setOpen = onOpenChange;
  const deleteInviteMutation = api.team.deleteTeamInvite.useMutation();

  const utils = api.useUtils();

  async function onInviteDelete() {
    deleteInviteMutation.mutate(
      {
        inviteId: invite.id,
      },
      {
        onSuccess: async () => {
          utils.team.getTeamInvites.invalidate();
          setOpen(false);
          toast.success("Convite cancelado com sucesso");
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
          <DialogTitle>Cancelar convite</DialogTitle>
          <DialogDescription>
            Tem certeza de que deseja cancelar o convite de{" "}
            <span className="font-semibold text-foreground">
              {invite.email}
            </span>
            ?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            isLoading={deleteInviteMutation.isPending}
            onClick={onInviteDelete}
            className="w-[150px]"
          >
            Excluir convite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTeamInvite;
