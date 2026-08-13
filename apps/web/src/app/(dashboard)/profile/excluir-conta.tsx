"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { format } from "date-fns";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { toast } from "@usesend/ui/src/toaster";

import { api } from "~/trpc/react";

/**
 * Exclusão em modo checklist: tudo que impede aparece no próprio dialog, com
 * o caminho para resolver. Nada de "você não pode excluir" sem dizer por quê.
 *
 * A confirmação final é só o OTP — digitar "EXCLUIR" confirmaria intenção,
 * não identidade.
 */
export function ExcluirConta() {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [precisaCodigo, setPrecisaCodigo] = useState(true);

  const bloqueios = api.user.bloqueiosDaExclusao.useQuery(undefined, {
    enabled: aberto,
  });
  const pedirCodigo = api.user.requestAccountDeletion.useMutation();
  const confirmar = api.user.confirmAccountDeletion.useMutation();

  const lista = bloqueios.data ?? [];
  const liberado = lista.length === 0;

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          setAberto(true);
          setCodigo("");
        }}
      >
        Excluir minha conta
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              {liberado
                ? "Você perde o acesso à plataforma e aos dados vinculados à sua conta. Esta ação não tem volta."
                : "Antes de excluir, resolva as pendências abaixo."}
            </DialogDescription>
          </DialogHeader>

          {bloqueios.isLoading ? (
            <div className="text-sm text-muted-foreground">Verificando…</div>
          ) : null}

          {!liberado ? (
            <ul className="flex flex-col gap-2 text-sm">
              {lista.map((b, i) => (
                <li key={i} className="rounded-md border p-3">
                  {b.tipo === "time" ? (
                    <>
                      <div className="font-medium">Time {b.nome}</div>
                      <div className="mt-1 text-muted-foreground">
                        {b.ultimoAdmin
                          ? "Você é o único admin. Transfira a administração a outro membro ou exclua o time."
                          : "Saia do time para continuar."}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        asChild
                      >
                        <a href="/settings/team">Abrir o time →</a>
                      </Button>
                    </>
                  ) : b.tipo === "troca_de_email" ? (
                    <>
                      <div className="font-medium">
                        Troca de e-mail em período de reversão
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        A exclusão fica bloqueada até{" "}
                        {format(b.ate, "dd/MM/yyyy, 'às' HH'h'mm")} — é o prazo
                        para reverter a troca, caso não tenha sido você.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium">Assinatura ativa</div>
                      <div className="mt-1 text-muted-foreground">
                        Cancele a assinatura antes de excluir a conta.
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {liberado ? (
            <div className="flex flex-col gap-3">
              {precisaCodigo ? (
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Código de 5 caracteres"
                  autoComplete="one-time-code"
                  maxLength={5}
                />
              ) : null}

              {precisaCodigo && !pedirCodigo.isSuccess ? (
                <Button
                  variant="outline"
                  disabled={pedirCodigo.isPending}
                  onClick={() =>
                    pedirCodigo.mutate(undefined, {
                      onSuccess: ({ codigoEnviado }) => {
                        // Sessão elevada há menos de 10 min já provou quem é.
                        setPrecisaCodigo(codigoEnviado);
                        if (codigoEnviado) {
                          toast.success("Código enviado para o seu e-mail");
                        }
                      },
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  {pedirCodigo.isPending ? "Enviando…" : "Enviar código"}
                </Button>
              ) : null}

              <Button
                variant="destructive"
                disabled={
                  confirmar.isPending || (precisaCodigo && codigo.length < 5)
                }
                onClick={() =>
                  confirmar.mutate(
                    { codigo: precisaCodigo ? codigo : undefined },
                    {
                      onSuccess: () => {
                        toast.success("Conta excluída");
                        signOut({ callbackUrl: "/login" });
                      },
                      onError: (e) => toast.error(e.message),
                    },
                  )
                }
              >
                {confirmar.isPending ? "Excluindo…" : "Excluir definitivamente"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
