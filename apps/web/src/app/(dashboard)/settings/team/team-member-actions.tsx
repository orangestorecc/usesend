"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  CopyIcon,
  KeyRound,
  LogOut,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2,
} from "lucide-react";
import type { Role } from "@prisma/client";

import { Button } from "@usesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@usesend/ui/src/dropdown-menu";
import { toast } from "@usesend/ui/src/toaster";

import { api } from "~/trpc/react";
import {
  ACCESS_LINK_VALIDADE_MINUTOS,
  minutosAte,
} from "~/lib/access-link";
import { EditTeamMember } from "./edit-team-member";
import { DeleteTeamMember } from "./delete-team-member";

/**
 * O servidor recusa link de acesso para alvo ADMIN. O texto aqui é o mesmo
 * fato, no vocabulário da tela (o servidor ainda diz "time").
 */
const MOTIVO_ALVO_ADMIN =
  "Não dá para gerar link de acesso para quem administra o workspace.";

/** Data de expiração em texto curto: "12/08, às 14:30". */
function quandoExpira(valor: Date | string) {
  return format(new Date(valor), "dd/MM',' 'às' HH:mm");
}

/**
 * Mensagem de erro para o usuário final.
 *
 * O texto do servidor não é repassado às cegas: erro de infraestrutura vaza
 * nome de variável de ambiente para um gestor de agência. Só mensagens de
 * regra de negócio (as que o servidor marca como esperadas) chegam ao toast.
 */
function mensagemDeErro(
  error: { message?: string; data?: { code?: string } | null },
  fallback: string,
) {
  const codigosComMensagemSegura = [
    "BAD_REQUEST",
    "FORBIDDEN",
    "UNAUTHORIZED",
    "NOT_FOUND",
    "CONFLICT",
    "TOO_MANY_REQUESTS",
    "PRECONDITION_FAILED",
  ];

  const code = error.data?.code;
  if (code && codigosComMensagemSegura.includes(code) && error.message) {
    return error.message;
  }

  return fallback;
}

export const TeamMemberActions: React.FC<{
  // `userId` é número no domínio; os routers antigos ainda pedem string.
  member: { userId: number; role: Role; email: string; nome?: string | null };
  isAdmin: boolean;
  self: boolean;
}> = ({ member, isAdmin, self }) => {
  const [dialogo, setDialogo] = useState<
    "editar" | "remover" | "acesso" | null
  >(null);

  const criarLink = api.team.createAccessLink.useMutation();
  const enviarLink = api.team.sendAccessLink.useMutation();

  const ocupado = criarLink.isPending || enviarLink.isPending;
  const comoChamar = member.nome || member.email;
  const alvoEhAdmin = member.role === "ADMIN";

  function onCopiarLink() {
    criarLink.mutate(
      { userId: member.userId },
      {
        onSuccess: async ({ url, expiresAt }) => {
          try {
            await navigator.clipboard.writeText(url);
            setDialogo(null);
            // O aviso pesado já foi dado na confirmação; aqui basta o fato
            // acionável: quanto tempo resta.
            toast.success(
              `Link copiado. Vale ${minutosAte(expiresAt)} minutos, até ${quandoExpira(
                expiresAt,
              )}.`,
            );
          } catch {
            toast.error(
              'Seu navegador bloqueou a cópia. Use "Enviar acesso por e-mail" ou libere a área de transferência.',
            );
          }
        },
        onError: (error) => {
          toast.error(
            mensagemDeErro(error, "Não foi possível gerar o link de acesso."),
          );
        },
      },
    );
  }

  function onEnviarPorEmail() {
    enviarLink.mutate(
      { userId: member.userId },
      {
        onSuccess: ({ expiresAt }) => {
          setDialogo(null);
          toast.success(
            `Link enviado para ${member.email}. Vale ${minutosAte(
              expiresAt,
            )} minutos, até ${quandoExpira(expiresAt)}.`,
          );
        },
        onError: (error) => {
          toast.error(
            mensagemDeErro(error, "Não foi possível enviar o link de acesso."),
          );
        },
      },
    );
  }

  if (!isAdmin && !self) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Ações do membro">
            <MoreHorizontalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          {isAdmin ? (
            <>
              <DropdownMenuItem onSelect={() => setDialogo("editar")}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Editar função
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Senha / acesso de emergência
              </DropdownMenuLabel>
              {/* Alvo ADMIN é recusado pelo servidor. Deixar o item habilitado
                  fazia a pessoa ler o diálogo inteiro e só descobrir no toast,
                  depois do clique. */}
              <DropdownMenuItem
                disabled={ocupado || alvoEhAdmin}
                title={alvoEhAdmin ? MOTIVO_ALVO_ADMIN : undefined}
                onSelect={(evento) => {
                  evento.preventDefault();
                  if (alvoEhAdmin) return;
                  setDialogo("acesso");
                }}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Gerar link de acesso
              </DropdownMenuItem>
              {alvoEhAdmin ? (
                <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">
                  {MOTIVO_ALVO_ADMIN} Peça para {comoChamar} usar “Entrar” no
                  Madmail e receber o código no próprio e-mail. Para tirar o
                  acesso de administrador, use “Editar função”.
                </p>
              ) : (
                /* Quem procura "gerar senha" precisa entender aqui, sem sair do
                   menu, que o Madmail não tem senha para gerar. */
                <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">
                  O Madmail não usa senha. O link de acesso é o equivalente:
                  entra na conta uma vez só e expira em{" "}
                  {ACCESS_LINK_VALIDADE_MINUTOS} minutos.
                </p>
              )}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            className="text-red"
            onSelect={() => setDialogo("remover")}
          >
            {self ? (
              <LogOut className="mr-2 h-4 w-4" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {self ? "Sair deste workspace" : "Remover do workspace"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmação ANTES de gerar: o clique produz uma credencial válida.
          Avisar depois, no toast, é avisar tarde. */}
      <Dialog
        open={dialogo === "acesso"}
        onOpenChange={(aberto) => setDialogo(aberto ? "acesso" : null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar link de acesso para {comoChamar}?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  O Madmail não tem senha para gerar ou redefinir. O que existe
                  é este link: quem abrir <strong>entra na conta</strong> de{" "}
                  {member.email}, sem pedir mais nada.
                </p>
                <p>
                  Ele funciona <strong>uma única vez</strong> e vale por{" "}
                  <strong>{ACCESS_LINK_VALIDADE_MINUTOS} minutos</strong>.
                  Mande só para essa pessoa, por um canal que você confia.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setDialogo(null)}
              disabled={ocupado}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              isLoading={enviarLink.isPending}
              disabled={ocupado}
              onClick={onEnviarPorEmail}
            >
              <MailIcon className="mr-2 h-4 w-4" />
              Enviar por e-mail
            </Button>
            <Button
              isLoading={criarLink.isPending}
              disabled={ocupado}
              onClick={onCopiarLink}
            >
              <CopyIcon className="mr-2 h-4 w-4" />
              Gerar e copiar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isAdmin ? (
        <EditTeamMember
          teamUser={{ userId: String(member.userId), role: member.role }}
          open={dialogo === "editar"}
          onOpenChange={(aberto) => setDialogo(aberto ? "editar" : null)}
        />
      ) : null}
      <DeleteTeamMember
        teamUser={{
          userId: String(member.userId),
          role: member.role,
          email: member.email,
        }}
        self={self}
        open={dialogo === "remover"}
        onOpenChange={(aberto) => setDialogo(aberto ? "remover" : null)}
      />
    </>
  );
};

export default TeamMemberActions;
