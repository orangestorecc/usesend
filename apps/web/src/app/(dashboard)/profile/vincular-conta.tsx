"use client";

import { signIn } from "next-auth/react";
import { Button } from "@usesend/ui/src/button";
import { toast } from "@usesend/ui/src/toaster";

import { api } from "~/trpc/react";

/**
 * Vincular usa o próprio fluxo de OAuth (o adapter liga a conta ao usuário
 * logado). Desvincular é só apagar a linha: o login por código no e-mail
 * continua existindo, então ninguém fica trancado para fora.
 */
export function VincularConta({
  provider,
  vinculada,
  onMudou,
}: {
  provider: string;
  vinculada: boolean;
  onMudou: () => void;
}) {
  const desvincular = api.user.desvincularConta.useMutation();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={desvincular.isPending}
      onClick={() => {
        if (!vinculada) {
          signIn(provider, { callbackUrl: "/profile" });
          return;
        }

        desvincular.mutate(
          { provider },
          {
            onSuccess: () => {
              toast.success("Conta desvinculada");
              onMudou();
            },
            onError: (e) => toast.error(e.message),
          },
        );
      }}
    >
      {vinculada ? "Desvincular" : "Vincular"}
    </Button>
  );
}
