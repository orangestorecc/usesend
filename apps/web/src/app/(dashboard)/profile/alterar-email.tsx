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

type Passo = "atual" | "novo" | "confirmar";

/**
 * Troca de e-mail em três passos (double opt-in). O código ao endereço novo
 * nunca é dispensado: sem prova de recebimento, a pessoa se tranca fora da
 * própria conta.
 */
export function AlterarEmail({
  emailAtual,
  temProvidersVinculados,
  onTrocado,
}: {
  emailAtual: string;
  temProvidersVinculados: boolean;
  onTrocado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState<Passo>("atual");
  const [codigoAtual, setCodigoAtual] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [codigoNovo, setCodigoNovo] = useState("");

  const pedirCodigo = api.user.requestEmailChange.useMutation();
  const definirNovo = api.user.setNewEmail.useMutation();
  const confirmar = api.user.confirmEmailChange.useMutation();

  function abrir() {
    setAberto(true);
    setPasso("atual");
    setCodigoAtual("");
    setEmailNovo("");
    setCodigoNovo("");

    pedirCodigo.mutate(undefined, {
      onSuccess: ({ codigoEnviado }) => {
        // Sessão elevada há menos de 10 min já provou identidade: pedir outro
        // código aqui seria fadiga de OTP sem ganho de segurança.
        if (!codigoEnviado) setPasso("novo");
      },
      onError: (e) => {
        toast.error(e.message);
        setAberto(false);
      },
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={abrir}>
        Alterar
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar e-mail de acesso</DialogTitle>
            <DialogDescription>
              {passo === "atual"
                ? `Enviamos um código para ${emailAtual}. Digite-o para continuar.`
                : passo === "novo"
                  ? "Informe o novo endereço. Ele receberá um código de confirmação."
                  : `Enviamos um código para ${emailNovo}. Digite-o para concluir.`}
            </DialogDescription>
          </DialogHeader>

          {passo === "atual" ? (
            <div className="flex flex-col gap-3">
              <Input
                value={codigoAtual}
                onChange={(e) => setCodigoAtual(e.target.value)}
                placeholder="Código de 5 caracteres"
                autoComplete="one-time-code"
                maxLength={5}
              />
              <Button
                disabled={codigoAtual.length < 5}
                onClick={() => setPasso("novo")}
              >
                Continuar
              </Button>
            </div>
          ) : null}

          {passo === "novo" ? (
            <div className="flex flex-col gap-3">
              <Input
                value={emailNovo}
                onChange={(e) => setEmailNovo(e.target.value)}
                placeholder="novo@email.com.br"
                type="email"
              />
              {temProvidersVinculados ? (
                <p className="text-xs text-muted-foreground">
                  Você tem contas Google ou GitHub vinculadas. Elas continuam
                  funcionando, mas o e-mail delas pode ficar diferente do seu
                  e-mail de acesso.
                </p>
              ) : null}
              <Button
                disabled={!emailNovo.includes("@") || definirNovo.isPending}
                onClick={() =>
                  definirNovo.mutate(
                    { newEmail: emailNovo, codigoAtual },
                    {
                      onSuccess: () => setPasso("confirmar"),
                      onError: (e) => toast.error(e.message),
                    },
                  )
                }
              >
                {definirNovo.isPending ? "Enviando…" : "Enviar código"}
              </Button>
            </div>
          ) : null}

          {passo === "confirmar" ? (
            <div className="flex flex-col gap-3">
              <Input
                value={codigoNovo}
                onChange={(e) => setCodigoNovo(e.target.value)}
                placeholder="Código de 5 caracteres"
                autoComplete="one-time-code"
                maxLength={5}
              />
              <Button
                disabled={codigoNovo.length < 5 || confirmar.isPending}
                onClick={() =>
                  confirmar.mutate(
                    { codigo: codigoNovo },
                    {
                      onSuccess: ({ email }) => {
                        toast.success(`E-mail alterado para ${email}`);
                        setAberto(false);
                        onTrocado();
                      },
                      onError: (e) => toast.error(e.message),
                    },
                  )
                }
              >
                {confirmar.isPending ? "Confirmando…" : "Concluir troca"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Avisaremos {emailAtual} com um link para reverter, válido por 7
                dias. As outras sessões serão encerradas.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
