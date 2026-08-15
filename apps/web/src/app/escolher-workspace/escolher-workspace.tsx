"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AlertCircle, Check, Search } from "lucide-react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";

import { api } from "~/trpc/react";
import { trocarWorkspace } from "~/utils/workspace";

/** A partir daqui, rolar a lista custa mais do que digitar. */
const LIMIAR_DA_BUSCA = 6;

/** Duas letras do nome ancoram visualmente "Padaria Silva" vs "Padaria Silva Matriz". */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

export function EscolherWorkspace() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: teams, status, refetch, isRefetching } = api.team.getTeams.useQuery();
  const [entrandoEm, setEntrandoEm] = useState<number | null>(null);
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = useMemo(
    () =>
      (teams ?? []).filter((team) =>
        termo ? team.name.toLowerCase().includes(termo) : true,
      ),
    [teams, termo],
  );

  // Com um workspace só não há escolha a fazer: mostrar uma lista de um item
  // é pedir um clique para confirmar o óbvio. Entra direto.
  const unico = teams?.length === 1 ? teams[0]! : null;
  const jaEntrou = useRef(false);
  useEffect(() => {
    if (!unico || jaEntrou.current) return;
    jaEntrou.current = true;
    setEntrandoEm(unico.id);
    void trocarWorkspace(unico.id).catch((erro: unknown) => {
      jaEntrou.current = false;
      setEntrandoEm(null);
      toast.error(
        erro instanceof Error
          ? erro.message
          : "Não foi possível abrir seu workspace. Tente de novo.",
      );
    });
  }, [unico]);

  async function onEscolher(teamId: number) {
    setEntrandoEm(teamId);
    try {
      await trocarWorkspace(teamId);
    } catch (erro) {
      setEntrandoEm(null);
      toast.error(
        erro instanceof Error
          ? erro.message
          : "Não foi possível trocar de workspace. Tente de novo.",
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Escolha um workspace</h1>
        <p className="text-sm text-muted-foreground">
          {teams && teams.length > 1
            ? `Você faz parte de ${teams.length} workspaces. Escolha em qual quer entrar agora — dá para trocar depois pelo menu lateral.`
            : teams && teams.length === 1
              ? "Você faz parte de 1 workspace. Abrindo…"
              : "Escolha em qual workspace quer entrar agora — dá para trocar depois pelo menu lateral."}
        </p>
        {/* Sem saída, quem entrou na conta errada fica preso nesta tela. */}
        <p className="text-sm text-muted-foreground">
          Conectado como{" "}
          <span className="font-medium text-foreground">
            {session?.user?.email ?? "…"}
          </span>
          .{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            Sair e entrar com outra conta
          </button>
        </p>
      </div>

      {status === "pending" ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" innerSvgClass="stroke-primary" />
        </div>
      ) : status === "error" ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red" />
            Não conseguimos carregar seus workspaces.
          </div>
          <Button
            variant="outline"
            size="sm"
            isLoading={isRefetching}
            onClick={() => void refetch()}
          >
            Tentar de novo
          </Button>
        </div>
      ) : !teams || teams.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground">
            Você ainda não faz parte de nenhum workspace. Peça um convite para
            quem administra o workspace ou crie o seu.
          </p>
          <Button size="sm" onClick={() => router.replace("/dashboard")}>
            Criar meu workspace
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {teams.length > LIMIAR_DA_BUSCA ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar workspace pelo nome"
                aria-label="Buscar workspace pelo nome"
                className="pl-9"
              />
            </div>
          ) : null}

          {filtrados.length === 0 ? (
            <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
              Nenhum workspace com “{busca}”.
            </p>
          ) : null}

          {filtrados.map((team) => {
            const papel =
              team.teamUsers[0]?.role === "ADMIN" ? "Administrador" : "Membro";
            const entrando = entrandoEm === team.id;
            return (
              <button
                key={team.id}
                type="button"
                disabled={entrandoEm !== null}
                onClick={() => void onEscolher(team.id)}
                className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
              >
                {/* Iniciais no lugar do ícone genérico: com 12 clientes, todo
                    cartão igual é convite para entrar no workspace errado. */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-xs font-semibold">
                  {iniciais(team.name)}
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium">
                    {team.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {papel} · criado em{" "}
                    {new Date(team.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {entrando ? (
                  <Spinner className="h-4 w-4" innerSvgClass="stroke-primary" />
                ) : (
                  <Check className="h-4 w-4 text-muted-foreground opacity-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EscolherWorkspace;
