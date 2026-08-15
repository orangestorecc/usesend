"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

// Define the Team type based on the Prisma schema
type Team = {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  plan: "FREE" | "BASIC";
  stripeCustomerId?: string | null;
  billingEmail?: string | null;
};

interface TeamContextType {
  currentTeam: Team | null;
  teams: Team[];
  isLoading: boolean;
  currentRole: "ADMIN" | "MEMBER";
  currentIsAdmin: boolean;
  /**
   * Sessão nascida de link de acesso: presa a um workspace só. Sinal
   * `acessoPresoAoTime` do backend, entregue ao cliente pelo layout do
   * dashboard (o cookie que o carrega é httpOnly).
   */
  acessoPresoAoWorkspace: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

/**
 * Avisa que o workspace mudou em outra aba e oferece recarregar.
 *
 * Não recarregamos sozinhos de propósito: a pessoa pode estar no meio de uma
 * campanha. Mas também não dá para ficar em silêncio — a tela já está
 * mostrando dados do workspace novo com o nome e o papel do antigo.
 */
function AvisoDeWorkspaceTrocado({ nome }: { nome: string | null }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm text-black"
    >
      Você trocou de workspace em outra aba
      {nome ? `: agora o ativo é ${nome}` : ""}. Esta aba ainda mostra o
      anterior. Ao recarregar, o que estiver aberto sem salvar aqui se perde.
      <button
        type="button"
        className="font-semibold underline"
        onClick={() => window.location.reload()}
      >
        Recarregar mesmo assim
      </button>
    </div>
  );
}

export function TeamProvider({
  children,
  workspaceAtivo = null,
  acessoPresoAoWorkspace = false,
}: {
  children: React.ReactNode;
  /**
   * Time do cookie, lido no render do servidor. Serve só como valor INICIAL,
   * para a sidebar não piscar antes da primeira resposta de `getTeams`.
   */
  workspaceAtivo?: number | null;
  acessoPresoAoWorkspace?: boolean;
}) {
  const { data: teams, status } = api.team.getTeams.useQuery();

  // Fonte da verdade: qual time o SERVIDOR resolveria neste request. Sem isto,
  // duas abas divergem em silêncio — a aba antiga lista membros do workspace
  // novo e oferece "Editar função"/"Remover" com o papel do workspace velho.
  const doServidor = teams?.find((team) => team.ativoNoServidor) ?? null;
  const currentTeam =
    doServidor ??
    teams?.find((team) => team.id === workspaceAtivo) ??
    teams?.[0] ??
    null;

  // O que esta aba já renderizou. Só há divergência depois de ter renderizado
  // algo: na primeira resposta apenas registramos.
  const renderizado = useRef<number | null>(null);
  const [divergente, setDivergente] = useState(false);

  useEffect(() => {
    const ativo = doServidor?.id ?? null;
    if (ativo === null) return;
    if (renderizado.current === null) {
      renderizado.current = ativo;
      return;
    }
    if (renderizado.current !== ativo) {
      setDivergente(true);
    }
  }, [doServidor?.id]);

  // Congela o time enquanto a divergência não é resolvida: trocar os dados por
  // baixo de quem está no meio de uma ação é o bug, não a correção.
  const congelado =
    divergente && renderizado.current !== null
      ? (teams?.find((team) => team.id === renderizado.current) ?? currentTeam)
      : currentTeam;

  const value = {
    currentTeam: congelado,
    teams: teams || [],
    isLoading: status === "pending",
    currentRole: congelado?.teamUsers[0]?.role ?? "MEMBER",
    currentIsAdmin: congelado?.teamUsers[0]?.role === "ADMIN",
    acessoPresoAoWorkspace,
  };

  return (
    <TeamContext.Provider value={value}>
      {divergente ? (
        <AvisoDeWorkspaceTrocado nome={doServidor?.name ?? null} />
      ) : null}
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
}
