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
import { Rocket } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

/**
 * Duas superficies em um componente so:
 *
 * - Modal de boas-vindas: aparece UMA vez, no primeiro acesso.
 * - Lembrete de continuar: aparece no maximo a cada 20h, e como toast discreto,
 *   nao como modal. Modal a cada login treina o usuario a fechar sem ler.
 */
export function OnboardingReminder() {
  const router = useRouter();
  const pathname = usePathname();
  const progressoQuery = api.onboarding.getProgress.useQuery();
  const dismissMutation = api.onboarding.dismissWelcome.useMutation();
  const markRemindedMutation = api.onboarding.markReminded.useMutation();
  const snoozeMutation = api.onboarding.snooze.useMutation();
  const utils = api.useUtils();

  const [lembreteAberto, setLembreteAberto] = useState(false);
  const jaLembrouNestaSessao = useRef(false);

  const progresso = progressoQuery.data;

  useEffect(() => {
    if (!progresso?.shouldRemind || jaLembrouNestaSessao.current) {
      return;
    }

    jaLembrouNestaSessao.current = true;
    setLembreteAberto(true);
    markRemindedMutation.mutate();
  }, [progresso?.shouldRemind, markRemindedMutation]);

  // Dentro do proprio wizard o lembrete e ruido.
  if (!progresso || progresso.isComplete || pathname === "/onboarding") {
    return null;
  }

  if (progresso.shouldShowWelcome) {
    return (
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Bem-vindo à Madmail</DialogTitle>
            <DialogDescription>
              Antes do primeiro disparo, são 5 passos rápidos: cadastrar seu
              domínio, validá-lo, criar uma lista, adicionar contatos e montar a
              campanha. A gente te guia em cada um.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              disabled={dismissMutation.isPending}
              onClick={() => {
                dismissMutation.mutate(undefined, {
                  onSuccess: () => utils.onboarding.getProgress.invalidate(),
                });
              }}
            >
              Depois eu vejo
            </Button>
            <Button
              disabled={dismissMutation.isPending}
              onClick={() => {
                dismissMutation.mutate(undefined, {
                  onSuccess: async () => {
                    await utils.onboarding.getProgress.invalidate();
                    router.push("/onboarding");
                  },
                });
              }}
            >
              Bora configurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!lembreteAberto) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[22rem] rounded-xl border bg-background p-4 shadow-lg">
      <p className="text-sm font-medium">
        Você parou no passo {progresso.completedCount + 1} de{" "}
        {progresso.totalCount}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Falta pouco para sua conta ficar pronta para enviar.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLembreteAberto(false);
            snoozeMutation.mutate(undefined, {
              onSuccess: () => utils.onboarding.getProgress.invalidate(),
            });
          }}
        >
          Não mostrar mais
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setLembreteAberto(false);
            router.push("/onboarding");
          }}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
