"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { toast } from "@usesend/ui/src/toaster";

import { api } from "~/trpc/react";

/**
 * Sair do workspace, com a transferência de administração no mesmo dialog quando
 * a pessoa é o único admin. Mandar embora para outra tela seria abandonar
 * quem está no meio da exclusão de conta.
 */
export function SairDoTime({
  teamId,
  nome,
  ultimoAdmin,
  onSaiu,
}: {
  teamId: number;
  nome: string;
  ultimoAdmin: boolean;
  onSaiu: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [destino, setDestino] = useState<string>("");

  const membros = api.user.membrosDoTime.useQuery(
    { teamId },
    { enabled: aberto && ultimoAdmin },
  );
  const sair = api.user.sairDoTime.useMutation();
  const transferir = api.user.transferirAdministracao.useMutation();

  const semMembros = (membros.data ?? []).length === 0;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        onClick={() => setAberto(true)}
      >
        Sair deste workspace
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Sair de {nome}</DialogTitle>
            <DialogDescription>
              {ultimoAdmin
                ? "Você é o único admin. Escolha quem assume a administração — a transferência e a saída acontecem juntas."
                : "Você perde o acesso aos domínios, contatos e envios deste workspace."}
            </DialogDescription>
          </DialogHeader>

          {ultimoAdmin ? (
            <div className="flex flex-col gap-3">
              {membros.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : semMembros ? (
                <div className="text-sm text-muted-foreground">
                  Este workspace não tem outros membros. Para sair, exclua o
                  workspace nas configurações.
                </div>
              ) : (
                <>
                  <Select value={destino} onValueChange={setDestino}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o novo admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {(membros.data ?? []).map((m) => (
                        <SelectItem key={m.userId} value={String(m.userId)}>
                          {m.nome ?? m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    disabled={!destino || transferir.isPending}
                    onClick={() =>
                      transferir.mutate(
                        { teamId, paraUserId: Number(destino) },
                        {
                          onSuccess: () => {
                            toast.success("Administração transferida");
                            setAberto(false);
                            onSaiu();
                          },
                          onError: (e) => toast.error(e.message),
                        },
                      )
                    }
                  >
                    {transferir.isPending ? "Transferindo…" : "Transferir e sair"}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Button
              variant="destructive"
              disabled={sair.isPending}
              onClick={() =>
                sair.mutate(
                  { teamId },
                  {
                    onSuccess: () => {
                      toast.success(`Você saiu de ${nome}`);
                      setAberto(false);
                      onSaiu();
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {sair.isPending ? "Saindo…" : "Sair deste workspace"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
