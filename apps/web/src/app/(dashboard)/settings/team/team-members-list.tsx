"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@usesend/ui/src/table";
import { Button } from "@usesend/ui/src/button";
import Spinner from "@usesend/ui/src/spinner";
import { formatDistanceToNow, isPast } from "date-fns";
import { AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";
import { useTeam } from "~/providers/team-context";
import { dataDeExpiracao } from "~/lib/invites";
import { TeamMemberActions } from "./team-member-actions";
import { TeamInviteActions } from "./team-invite-actions";

/** "há 3 meses" / "em 5 dias" — sempre relativo, locale pt-BR já é global. */
function quando(valor: Date | string) {
  return formatDistanceToNow(new Date(valor), { addSuffix: true });
}

export default function TeamMembersList() {
  const { currentIsAdmin } = useTeam();
  const { data: session } = useSession();
  const teamUsersQuery = api.team.getTeamUsers.useQuery();
  const teamInvitesQuery = api.team.getTeamInvites.useQuery();

  const teamMembers = teamUsersQuery.data ?? [];
  const pendingInvites = teamInvitesQuery.data ?? [];

  const isLoading = teamUsersQuery.isLoading || teamInvitesQuery.isLoading;
  const erro = teamUsersQuery.error ?? teamInvitesQuery.error;

  function recarregar() {
    void teamUsersQuery.refetch();
    void teamInvitesQuery.refetch();
  }

  return (
    <div className="mt-10 flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium">Pessoas com acesso</h2>
          {!isLoading && !erro ? (
            <span className="text-xs text-muted-foreground">
              {teamMembers.length}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col rounded-xl border border-border shadow">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="rounded-tl-xl">Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrou</TableHead>
                <TableHead className="rounded-tr-xl text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="h-32">
                  <TableCell colSpan={5} className="text-center py-4">
                    <Spinner
                      className="w-6 h-6 mx-auto"
                      innerSvgClass="stroke-primary"
                    />
                  </TableCell>
                </TableRow>
              ) : erro ? (
                <TableRow className="h-32">
                  <TableCell colSpan={5} className="py-4">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-red" />
                        Não conseguimos carregar as pessoas deste workspace
                        agora.
                      </div>
                      <Button variant="outline" size="sm" onClick={recarregar}>
                        Tentar de novo
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : teamMembers.length > 0 ? (
                teamMembers.map((member) => {
                  const email = member.user?.email ?? "E-mail não informado";
                  // `user.name` existe e é o que o administrador reconhece; o
                  // e-mail vira a linha de apoio, não a identidade.
                  const nome = member.user?.name?.trim() || null;
                  const self = session?.user.id == member.userId;
                  return (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{nome ?? email}</span>
                          {nome ? (
                            <span className="text-xs text-muted-foreground">
                              {email}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="rounded py-1 text-xs">
                          {member.role === "ADMIN" ? "Administrador" : "Membro"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center w-[100px] rounded py-1 text-xs bg-green/15 text-green border border-green/25">
                          Ativo
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* Entrada no workspace (`joinedAt`), não a criação da conta. */}
                        {quando(member.joinedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <TeamMemberActions
                          member={{
                            userId: member.userId,
                            role: member.role,
                            email,
                            nome,
                          }}
                          isAdmin={currentIsAdmin}
                          self={self}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="h-32">
                  <TableCell
                    colSpan={5}
                    className="text-center py-4 text-sm text-muted-foreground"
                  >
                    {pendingInvites.length > 0
                      ? "Ninguém aceitou o convite ainda. Os convites pendentes estão logo abaixo."
                      : "Você é a única pessoa neste workspace. Convide alguém para começar."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Convites moram numa tabela própria: misturados aos membros, com 20
          linhas, ninguém acha — e o cabeçalho "Entrou" mentia para eles. */}
      {!isLoading && !erro && pendingInvites.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium">Convites pendentes</h2>
            <span className="text-xs text-muted-foreground">
              {pendingInvites.length}
            </span>
          </div>

          <div className="flex flex-col rounded-xl border border-border shadow">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="rounded-tl-xl">Convidado</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="rounded-tr-xl text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => {
                  // Regra de prazo vem de `~/lib/invites`: duplicar o cálculo
                  // aqui já fez a UI e o servidor discordarem.
                  const expiraEm = dataDeExpiracao(invite);
                  const expirado = isPast(expiraEm);
                  return (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">
                        {invite.email}
                      </TableCell>
                      <TableCell>
                        <div className="w-[100px] rounded py-1 text-xs">
                          {invite.role === "ADMIN" ? "Administrador" : "Membro"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className={
                            expirado
                              ? "text-center w-[100px] rounded py-1 text-xs bg-red/15 text-red border border-red/25"
                              : "text-center w-[100px] rounded py-1 text-xs bg-yellow/15 text-yellow border border-yellow/25"
                          }
                        >
                          {expirado ? "Expirado" : "Pendente"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            Convidado {quando(invite.createdAt)}
                          </span>
                          <span
                            className={
                              expirado
                                ? "text-xs text-red"
                                : "text-xs text-muted-foreground"
                            }
                          >
                            {expirado
                              ? `Expirou ${quando(expiraEm)} — reenvie para gerar um prazo novo`
                              : `Expira ${quando(expiraEm)}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {currentIsAdmin ? (
                          <TeamInviteActions
                            invite={{ ...invite, expirado }}
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
