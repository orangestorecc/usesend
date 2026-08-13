"use client";

import { useState } from "react";
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
 * Ativação e desativação da confirmação por e-mail. Sem provider social
 * vinculado o card não mostra toggle morto: leva a vincular um.
 */
export function MfaCard({
  ativado,
  temProviderSocial,
  onMudou,
}: {
  ativado: boolean;
  temProviderSocial: boolean;
  onMudou: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const pedirCodigo = api.mfa.pedirCodigoDeAtivacao.useMutation();
  const ativar = api.mfa.ativar.useMutation();
  const desativar = api.mfa.desativar.useMutation();

  if (!temProviderSocial && !ativado) {
    return (
      <div className="text-sm text-muted-foreground">
        Esta proteção vale para logins com Google ou GitHub. Vincule uma dessas
        contas acima para poder ativá-la.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm">{ativado ? "Ativada" : "Desativada"}</span>
        <Button
          size="sm"
          variant={ativado ? "ghost" : "default"}
          disabled={pedirCodigo.isPending || desativar.isPending}
          onClick={() => {
            if (ativado) {
              // Sessão elevada dispensa o código aqui; o servidor decide.
              desativar.mutate(
                {},
                {
                  onSuccess: () => {
                    toast.success("Confirmação por e-mail desativada");
                    onMudou();
                  },
                  onError: (e) => toast.error(e.message),
                },
              );
              return;
            }

            pedirCodigo.mutate(undefined, {
              onSuccess: () => {
                setCodigo("");
                setRecoveryCodes(null);
                setAberto(true);
              },
              onError: (e) => toast.error(e.message),
            });
          }}
        >
          {ativado ? "Desativar" : "Ativar"}
        </Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {recoveryCodes
                ? "Guarde seus códigos de recuperação"
                : "Ativar confirmação por e-mail"}
            </DialogTitle>
            <DialogDescription>
              {recoveryCodes
                ? "Eles aparecem uma única vez. Cada código serve para entrar uma vez se você perder o acesso ao e-mail."
                : "Enviamos um código para o seu e-mail. Digitá-lo prova que você recebe mensagens nesse endereço — é o que evita ficar trancado fora da conta."}
            </DialogDescription>
          </DialogHeader>

          {recoveryCodes ? (
            <div className="flex flex-col gap-3">
              <ul className="grid grid-cols-2 gap-2 rounded-md border p-3 font-mono text-sm">
                {recoveryCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(recoveryCodes.join("\n"));
                  toast.success("Códigos copiados");
                }}
                variant="ghost"
              >
                Copiar códigos
              </Button>
              <Button onClick={() => setAberto(false)}>Guardei</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código de 5 caracteres"
                autoComplete="one-time-code"
                maxLength={5}
              />
              <Button
                disabled={codigo.length < 5 || ativar.isPending}
                onClick={() =>
                  ativar.mutate(
                    { codigo },
                    {
                      onSuccess: ({ recoveryCodes: codes }) => {
                        setRecoveryCodes(codes);
                        onMudou();
                      },
                      onError: (e) => toast.error(e.message),
                    },
                  )
                }
              >
                {ativar.isPending ? "Ativando…" : "Ativar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
