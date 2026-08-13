"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { Button } from "@usesend/ui/src/button";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@usesend/ui/src/popover";
import { formatDistanceToNow } from "date-fns";
import { MailCheck, MoreVertical, Pause, Play, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { ForwardingStatusBadge } from "./forwarding-status-badge";

export function ForwardingList() {
  const rulesQuery = api.forwarding.list.useQuery();
  const setStatus = api.forwarding.setStatus.useMutation();
  const resend = api.forwarding.resendVerification.useMutation();
  const remove = api.forwarding.delete.useMutation();
  const utils = api.useUtils();

  const regras = rulesQuery.data ?? [];

  function comFeedback(mensagem: string) {
    return {
      onSuccess: async () => {
        await utils.forwarding.list.invalidate();
        toast.success(mensagem);
      },
      onError: (error: { message: string }) => toast.error(error.message),
    };
  }

  return (
    <div className="mt-8">
      <div className="rounded-xl border shadow">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="rounded-tl-xl">Origem</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Encaminhados</TableHead>
              <TableHead>Último envio</TableHead>
              <TableHead className="rounded-tr-xl text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rulesQuery.isLoading ? (
              <TableRow className="h-32">
                <TableCell colSpan={6} className="py-4 text-center">
                  <Spinner
                    className="mx-auto h-6 w-6"
                    innerSvgClass="stroke-primary"
                  />
                </TableCell>
              </TableRow>
            ) : regras.length === 0 ? (
              <TableRow className="h-32">
                <TableCell colSpan={6} className="py-4 text-center">
                  <p>Nenhuma regra de encaminhamento</p>
                </TableCell>
              </TableRow>
            ) : (
              regras.map((regra) => (
                <TableRow key={regra.id}>
                  <TableCell className="font-medium">
                    {regra.domain?.name ?? "Todos os domínios"}
                  </TableCell>
                  <TableCell>{regra.destination}</TableCell>
                  <TableCell>
                    <ForwardingStatusBadge status={regra.status} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {regra.forwardedCount}
                    {regra.failedCount > 0 ? (
                      <span className="ml-1 text-muted-foreground">
                        ({regra.failedCount} com falha)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {regra.lastForwardedAt
                      ? formatDistanceToNow(new Date(regra.lastForwardedAt), {
                          addSuffix: true,
                        })
                      : "Nunca"}
                  </TableCell>
                  <TableCell className="text-right">
                    <RuleActions
                      pendente={regra.status === "PENDING_VERIFICATION"}
                      ativa={regra.status === "ACTIVE"}
                      podeAtivar={Boolean(regra.verifiedAt)}
                      onResend={() =>
                        resend.mutate(
                          { id: regra.id },
                          comFeedback("E-mail de confirmação reenviado"),
                        )
                      }
                      onToggle={(ativar) =>
                        setStatus.mutate(
                          { id: regra.id, active: ativar },
                          comFeedback(
                            ativar ? "Regra retomada" : "Regra pausada",
                          ),
                        )
                      }
                      onDelete={() =>
                        remove.mutate(
                          { id: regra.id },
                          comFeedback("Regra removida"),
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RuleActions({
  pendente,
  ativa,
  podeAtivar,
  onResend,
  onToggle,
  onDelete,
}: {
  pendente: boolean;
  ativa: boolean;
  podeAtivar: boolean;
  onResend: () => void;
  onToggle: (ativarRegra: boolean) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  function executar(acao: () => void) {
    acao();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 rounded-xl p-1" align="end">
        <div className="flex flex-col">
          {pendente ? (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start rounded-lg"
              onClick={() => executar(onResend)}
            >
              <MailCheck className="mr-2 h-4 w-4" />
              Reenviar confirmação
            </Button>
          ) : null}
          {podeAtivar ? (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start rounded-lg"
              onClick={() => executar(() => onToggle(!ativa))}
            >
              {ativa ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Retomar
                </>
              )}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="justify-start rounded-lg text-destructive hover:text-destructive"
            onClick={() => executar(onDelete)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remover
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
