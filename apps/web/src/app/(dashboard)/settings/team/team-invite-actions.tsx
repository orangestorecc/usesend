"use client";

import { useState } from "react";
import { CopyIcon, MoreHorizontalIcon, RotateCw, Trash2 } from "lucide-react";

import { Button } from "@usesend/ui/src/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@usesend/ui/src/dropdown-menu";

import { DeleteTeamInvite } from "./delete-team-invite";
import { useReenviarConvite } from "./resend-team-invite";

export const TeamInviteActions: React.FC<{
  invite: { id: string; email: string; expirado?: boolean };
}> = ({ invite }) => {
  const [cancelando, setCancelando] = useState(false);
  const { reenviar, copiarLink, reenviando } = useReenviarConvite(invite);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Ações do convite">
            <MoreHorizontalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem
            disabled={reenviando}
            onSelect={(evento) => {
              evento.preventDefault();
              reenviar();
            }}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            {invite.expirado ? "Reenviar com prazo novo" : "Reenviar convite"}
          </DropdownMenuItem>
          {/* Convite expirado não oferece o link: ele já não abre nada. */}
          <DropdownMenuItem
            disabled={invite.expirado}
            onSelect={(evento) => {
              evento.preventDefault();
              void copiarLink();
            }}
          >
            <CopyIcon className="mr-2 h-4 w-4" />
            Copiar link do convite
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red"
            onSelect={() => setCancelando(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Cancelar convite
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteTeamInvite
        invite={invite}
        open={cancelando}
        onOpenChange={setCancelando}
      />
    </>
  );
};

export default TeamInviteActions;
