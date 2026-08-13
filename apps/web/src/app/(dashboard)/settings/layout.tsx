"use client";

import { useTeam } from "~/providers/team-context";
import { SettingsNavButton } from "../dev-settings/settings-nav-button";
import { isCloud } from "~/utils/common";

export const dynamic = "force-static";

export default function ApiKeysPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentIsAdmin } = useTeam();

  return (
    <div>
      <h1 className="font-bold text-lg">Configurações</h1>
      <div className="flex gap-4 mt-4">
        {isCloud() ? (
          <SettingsNavButton href="/settings">Meu plano</SettingsNavButton>
        ) : null}
        {currentIsAdmin && isCloud() ? (
          <SettingsNavButton href="/settings/billing">
            Faturamento
          </SettingsNavButton>
        ) : null}
        <SettingsNavButton href="/settings/team">Time</SettingsNavButton>
        <SettingsNavButton href="/settings/unsubscribe-page">
          Página de descadastramento
        </SettingsNavButton>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
