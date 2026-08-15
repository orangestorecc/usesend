"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Lock } from "lucide-react";

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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@usesend/ui/src/sidebar";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";

import { useTeam } from "~/providers/team-context";
import { trocarWorkspace } from "~/utils/workspace";

/** Duas letras que sobrevivem à sidebar colapsada. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "??";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

/** Selo com as iniciais — é a âncora do workspace ativo quando só cabe o ícone. */
function SeloDoWorkspace({ nome }: { nome: string | null }) {
  return (
    <div
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sidebar-accent text-[10px] font-semibold"
    >
      {nome ? iniciais(nome) : "??"}
    </div>
  );
}

/**
 * Troca de workspace sem deslogar.
 *
 * Com um workspace só o seletor não abre menu, mas continua na tela: a âncora
 * de "em qual cliente eu estou" precisa existir sempre — inclusive com a
 * sidebar colapsada, onde o nome some e sobra o selo.
 */
export function WorkspaceSwitcher() {
  const { teams, currentTeam, isLoading, acessoPresoAoWorkspace } = useTeam();
  const { isMobile } = useSidebar();
  const [trocandoPara, setTrocandoPara] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState<{
    id: number;
    name: string;
  } | null>(null);

  if (isLoading) {
    return null;
  }

  const nomeAtual = currentTeam?.name ?? null;

  const rotulo = nomeAtual ?? "Nenhum workspace ativo";

  // Sessão de link de acesso é presa a um workspace: o servidor recusa a troca
  // com 403. Oferecer o menu era prometer uma porta que não abre.
  if (teams.length < 2 || acessoPresoAoWorkspace) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={
              acessoPresoAoWorkspace
                ? `Workspace: ${rotulo} — este acesso vale só aqui. Entre pela sua própria conta para trocar.`
                : `Workspace: ${rotulo}`
            }
            className="cursor-default"
          >
            <SeloDoWorkspace nome={nomeAtual} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={
                  nomeAtual
                    ? "truncate"
                    : "truncate italic text-muted-foreground"
                }
              >
                {rotulo}
              </span>
              {/* Sem cadeado e sem legenda, o item só parecia um botão quebrado:
                  nada explicava por que não abre. */}
              {acessoPresoAoWorkspace ? (
                <span className="truncate text-xs text-muted-foreground">
                  Acesso só a este workspace
                </span>
              ) : null}
            </div>
            {acessoPresoAoWorkspace ? (
              <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : null}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  async function confirmarTroca() {
    if (!confirmando) return;
    setTrocandoPara(confirmando.id);
    try {
      await trocarWorkspace(confirmando.id);
    } catch (erro) {
      setTrocandoPara(null);
      setConfirmando(null);
      toast.error(
        erro instanceof Error
          ? erro.message
          : "Não foi possível trocar de workspace. Tente de novo.",
      );
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              tooltip={`Workspace: ${rotulo} — clique para trocar`}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <SeloDoWorkspace nome={nomeAtual} />
              <span
                className={
                  nomeAtual
                    ? "truncate"
                    : "truncate italic text-muted-foreground"
                }
              >
                {rotulo}
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-xl"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Seus workspaces
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {teams.map((team) => {
              const atual = team.id === currentTeam?.id;
              return (
                <DropdownMenuItem
                  key={team.id}
                  disabled={trocandoPara !== null}
                  onSelect={(evento) => {
                    evento.preventDefault();
                    if (atual) return;
                    setConfirmando({ id: team.id, name: team.name });
                  }}
                >
                  <SeloDoWorkspace nome={team.name} />
                  <span className="flex-1 truncate">{team.name}</span>
                  {trocandoPara === team.id ? (
                    <Spinner className="h-4 w-4" innerSvgClass="stroke-primary" />
                  ) : atual ? (
                    <Check className="size-4" />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* A troca recarrega a página inteira. Sem esta confirmação, um clique
            no menu joga fora a campanha que estava sendo escrita. */}
        <Dialog
          open={confirmando !== null}
          onOpenChange={(aberto) => {
            if (!aberto && trocandoPara === null) setConfirmando(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Trocar para {confirmando?.name}?</DialogTitle>
              <DialogDescription>
                A página vai recarregar no workspace {confirmando?.name} e o que
                estiver aberto sem salvar aqui em {rotulo} se perde.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={trocandoPara !== null}
                onClick={() => setConfirmando(null)}
              >
                Ficar em {rotulo}
              </Button>
              <Button
                isLoading={trocandoPara !== null}
                onClick={() => void confirmarTroca()}
              >
                Trocar de workspace
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export default WorkspaceSwitcher;
