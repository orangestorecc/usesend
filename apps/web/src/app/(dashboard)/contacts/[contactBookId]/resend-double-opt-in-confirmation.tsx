"use client";

import { Button } from "@usesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@usesend/ui/src/tooltip";
import { Send } from "lucide-react";
import { useState } from "react";
import { api } from "~/trpc/react";

type BloqueioOptIn =
  | "DOUBLE_OPT_IN_DISABLED"
  | "NO_VERIFIED_DOMAIN"
  | "SENDER_DOMAIN_NOT_VERIFIED"
  | null;

function mensagemDeBloqueio(bloqueio: Exclude<BloqueioOptIn, null>) {
  switch (bloqueio) {
    case "NO_VERIFIED_DOMAIN":
      return "Valide um domínio de envio para pedir a confirmação deste contato";
    case "SENDER_DOMAIN_NOT_VERIFIED":
      return "O remetente desta lista usa um domínio que ainda não foi validado";
    case "DOUBLE_OPT_IN_DISABLED":
      return "O double opt-in está desligado nesta lista";
  }
}

export function ResendDoubleOptInConfirmation({
  contactBookId,
  contactId,
  email,
  bloqueio = null,
}: {
  contactBookId: string;
  contactId: string;
  email: string;
  bloqueio?: BloqueioOptIn;
}) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const resendMutation =
    api.contacts.resendDoubleOptInConfirmation.useMutation();

  const bloqueado = bloqueio !== null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span envolve o botao porque um <button disabled> nao dispara os
              eventos de hover que o tooltip precisa — sem isso o usuario ve o
              icone apagado e nenhuma explicacao. */}
          <span className={bloqueado ? "cursor-not-allowed" : undefined}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
              disabled={resendMutation.isPending || bloqueado}
            >
              {resendMutation.isPending ? (
                <Spinner className="h-4 w-4" innerSvgClass="stroke-primary" />
              ) : (
                <Send className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {bloqueado
              ? mensagemDeBloqueio(bloqueio)
              : "Reenviar e-mail de confirmação"}
          </p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reenviar e-mail de confirmação</DialogTitle>
            <DialogDescription>
              Enviar um novo e-mail de confirmação de double opt-in para{" "}
              <strong>{email}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={resendMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                resendMutation.mutate(
                  {
                    contactBookId,
                    contactId,
                  },
                  {
                    onSuccess: async () => {
                      await utils.contacts.contacts.invalidate();
                      toast.success(`E-mail de confirmação reenviado para ${email}`);
                      setOpen(false);
                    },
                    onError: (error) => {
                      toast.error(error.message);
                    },
                  },
                );
              }}
              disabled={resendMutation.isPending}
            >
              {resendMutation.isPending ? "Reenviando..." : "Reenviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
