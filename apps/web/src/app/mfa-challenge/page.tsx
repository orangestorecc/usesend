"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { toast } from "@usesend/ui/src/toaster";

import { api } from "~/trpc/react";

/**
 * Fica fora do gate de propósito: é a única tela que uma sessão com MFA
 * pendente consegue abrir.
 */
export default function MfaChallengePage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [modoRecovery, setModoRecovery] = useState(false);

  const verificar = api.mfa.verificar.useMutation();
  const recovery = api.mfa.usarRecovery.useMutation();
  const reenviar = api.mfa.reenviar.useMutation();

  const pendente = verificar.isPending || recovery.isPending;

  function enviar() {
    const opcoes = {
      onSuccess: () => {
        router.replace("/dashboard");
        router.refresh();
      },
      onError: (e: { message: string }) => toast.error(e.message),
    };

    if (modoRecovery) {
      recovery.mutate({ codigo }, opcoes);
    } else {
      verificar.mutate({ codigo }, opcoes);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border p-6">
        <h1 className="text-lg font-medium">Confirme que é você</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {modoRecovery
            ? "Digite um dos códigos de recuperação que você guardou."
            : "Enviamos um código para o seu e-mail. Ele vale por 10 minutos."}
        </p>

        <Input
          className="mt-4"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && codigo) enviar();
          }}
          placeholder={modoRecovery ? "Código de recuperação" : "Código"}
          autoComplete="one-time-code"
          autoFocus
        />

        <Button
          className="mt-3 w-full"
          disabled={!codigo || pendente}
          onClick={enviar}
        >
          {pendente ? "Verificando…" : "Entrar"}
        </Button>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          {!modoRecovery ? (
            <button
              className="text-left underline"
              disabled={reenviar.isPending}
              onClick={() =>
                reenviar.mutate(undefined, {
                  onSuccess: () => toast.success("Código reenviado"),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Reenviar código
            </button>
          ) : null}
          <button
            className="text-left underline"
            onClick={() => {
              setModoRecovery((v) => !v);
              setCodigo("");
            }}
          >
            {modoRecovery
              ? "Usar o código enviado por e-mail"
              : "Usar um código de recuperação"}
          </button>
          <button
            className="text-left text-muted-foreground underline"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
