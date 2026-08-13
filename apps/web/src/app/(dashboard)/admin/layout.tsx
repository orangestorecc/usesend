"use client";

import { SettingsNavButton } from "../dev-settings/settings-nav-button";
import { isCloud } from "~/utils/common";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-lg font-bold">Admin</h1>
      <div className="mt-4 flex gap-4">
        <SettingsNavButton href="/admin">
          Configurações SES
        </SettingsNavButton>
        <SettingsNavButton href="/admin/design-system">
          Design System
        </SettingsNavButton>
        <SettingsNavButton href="/admin/brand">
          Brand
        </SettingsNavButton>
        <SettingsNavButton href="/admin/feedback">
          Feedback
        </SettingsNavButton>
        {isCloud() ? (
          <SettingsNavButton href="/admin/teams">
            Clientes
          </SettingsNavButton>
        ) : null}
        {isCloud() ? (
          <SettingsNavButton href="/admin/email-analytics">
            Análise de e-mails
          </SettingsNavButton>
        ) : null}
        {isCloud() ? (
          <SettingsNavButton href="/admin/waitlist">
            Lista de espera
          </SettingsNavButton>
        ) : null}
        {isCloud() ? (
          <SettingsNavButton href="/admin/planos">
            Planos
          </SettingsNavButton>
        ) : null}
        {isCloud() ? (
          <SettingsNavButton href="/admin/payments">
            Pagamentos
          </SettingsNavButton>
        ) : null}
        <SettingsNavButton href="/admin/recebimento">
          Recebimento
        </SettingsNavButton>
        <SettingsNavButton href="/admin/receita">
          Consulta CNPJ
        </SettingsNavButton>
        <SettingsNavButton href="/admin/auditoria">
          Auditoria
        </SettingsNavButton>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
