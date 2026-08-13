"use client";

import { Button } from "@usesend/ui/src/button";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";

/**
 * Explica por que os contatos estao pendentes e, quando o dominio ja esta
 * validado, oferece o disparo em massa dos pedidos de confirmacao.
 */
export function DoubleOptInBanner({
  contactBookId,
}: {
  contactBookId: string;
}) {
  const utils = api.useUtils();
  const readinessQuery = api.contacts.doubleOptInReadiness.useQuery({
    contactBookId,
  });
  const bulkMutation = api.contacts.sendBulkDoubleOptIn.useMutation();

  const readiness = readinessQuery.data;

  if (!readiness?.doubleOptInEnabled || readiness.pendingCount === 0) {
    return null;
  }

  const contatos =
    readiness.pendingCount === 1
      ? "1 contato aguardando confirmação"
      : `${readiness.pendingCount} contatos aguardando confirmação`;

  if (!readiness.canSend) {
    const bloqueioDeDominio = readiness.blockReason !== "DOUBLE_OPT_IN_DISABLED";

    return (
      <div className="flex items-start gap-3 rounded-xl border border-yellow/25 bg-yellow/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{contatos}</p>
          <p className="text-sm text-muted-foreground">
            {readiness.blockReason === "SENDER_DOMAIN_NOT_VERIFIED"
              ? "O remetente configurado nesta lista usa um domínio que ainda não foi validado. Enquanto isso, os pedidos de confirmação não são enviados."
              : "Você ainda não tem um domínio validado para enviar. Os contatos foram salvos, mas os pedidos de confirmação só saem depois da validação."}
          </p>
          {bloqueioDeDominio ? (
            <Link
              href="/domains"
              className="mt-1 text-sm font-medium underline underline-offset-4"
            >
              Validar meu domínio
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const emEspera = readiness.bulkAvailableAt
    ? new Date(readiness.bulkAvailableAt)
    : null;

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-green/25 bg-green/10 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{contatos}</p>
          <p className="text-sm text-muted-foreground">
            Seu domínio está validado. Envie o pedido de confirmação para quem
            ainda não recebeu.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        disabled={
          bulkMutation.isPending ||
          readiness.eligibleCount === 0 ||
          emEspera !== null
        }
        title={
          emEspera
            ? `Disponível novamente às ${emEspera.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : readiness.eligibleCount === 0
              ? "Todos os pendentes já receberam um pedido nas últimas 24 horas"
              : undefined
        }
        onClick={() => {
          bulkMutation.mutate(
            { contactBookId },
            {
              onSuccess: async (resultado) => {
                await Promise.all([
                  utils.contacts.doubleOptInReadiness.invalidate(),
                  utils.contacts.contacts.invalidate(),
                ]);

                if (resultado.sent === 0) {
                  toast.error("Nenhum pedido pôde ser enviado agora");
                  return;
                }

                toast.success(
                  resultado.failed > 0
                    ? `${resultado.sent} pedidos enviados, ${resultado.failed} falharam`
                    : `${resultado.sent} pedidos de confirmação enviados`,
                );
              },
              onError: (error) => toast.error(error.message),
            },
          );
        }}
      >
        {bulkMutation.isPending ? (
          <Spinner className="mr-2 h-4 w-4" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        Enviar {readiness.eligibleCount} pedidos
      </Button>
    </div>
  );
}
