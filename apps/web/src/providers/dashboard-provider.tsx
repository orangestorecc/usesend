"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FullScreenLoading } from "~/components/FullScreenLoading";
import { AddSesSettings } from "~/components/settings/AddSesSettings";
import CreateTeam from "~/components/team/CreateTeam";
import { env } from "~/env";
import { api } from "~/trpc/react";
import { TeamProvider } from "./team-context";

export const DashboardProvider = ({
  children,
  workspaceAtivo = null,
  acessoPresoAoWorkspace = false,
}: {
  children: React.ReactNode;
  /** Time escolhido no cookie, lido no servidor. `null` = ainda não escolheu. */
  workspaceAtivo?: number | null;
  /** Sessão de link de acesso: presa a um workspace, não pode trocar. */
  acessoPresoAoWorkspace?: boolean;
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: teams, status } = api.team.getTeams.useQuery();
  const { data: settings, status: settingsStatus } =
    api.admin.getSesSettings.useQuery(undefined, {
      enabled: !env.NEXT_PUBLIC_IS_CLOUD || session?.user.isAdmin,
    });

  // Com mais de um workspace e nenhuma escolha válida, quem decide é a pessoa —
  // não a ordem da lista. Sem isso, o usuário abre o app num time aleatório e
  // acha que perdeu os dados.
  const precisaEscolher =
    Boolean(teams?.length && teams.length > 1) &&
    !teams?.some((team) => team.id === workspaceAtivo);

  useEffect(() => {
    if (precisaEscolher) {
      router.replace("/escolher-workspace");
    }
  }, [precisaEscolher, router]);

  if (
    status === "pending" ||
    (settingsStatus === "pending" && !env.NEXT_PUBLIC_IS_CLOUD)
  ) {
    return <FullScreenLoading />;
  }

  if (
    settings?.length === 0 &&
    (!env.NEXT_PUBLIC_IS_CLOUD || session?.user.isAdmin)
  ) {
    return <AddSesSettings />;
  }

  if (!teams || teams.length === 0) {
    return <CreateTeam />;
  }

  if (precisaEscolher) {
    return <FullScreenLoading />;
  }

  return (
    <TeamProvider
      workspaceAtivo={workspaceAtivo}
      acessoPresoAoWorkspace={acessoPresoAoWorkspace}
    >
      {children}
    </TeamProvider>
  );
};
