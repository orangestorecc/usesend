import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { avaliarGate } from "~/server/service/mfa-service";
import { DashboardProvider } from "~/providers/dashboard-provider";
import { NextAuthProvider } from "~/providers/next-auth";
import { DashboardLayout } from "./dasboard-layout";
import { BillingBanner } from "./billing-banner";

export const dynamic = "force-dynamic";

async function ImpersonationBanner() {
  const cookieStore = await cookies();
  if (!cookieStore.get("madmail-impersonator")) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm text-black">
      Você está acessando a conta de um cliente.
      <a href="/api/admin/stop-impersonate" className="font-semibold underline">
        Voltar para o admin
      </a>
    </div>
  );
}

/**
 * Sessão com MFA pendente não renderiza nada do dashboard — o redirecionamento
 * acontece antes de qualquer dado aparecer na tela.
 */
async function bloquearSeMfaPendente() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("__Secure-next-auth.session-token")?.value ??
    cookieStore.get("next-auth.session-token")?.value ??
    null;

  const gate = await avaliarGate(token);
  if (!gate.liberado && gate.motivo === "mfa_pendente") {
    redirect("/mfa-challenge");
  }
}

export default async function AuthenticatedDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await bloquearSeMfaPendente();

  return (
    <NextAuthProvider>
      <DashboardProvider>
        <ImpersonationBanner />
        <BillingBanner />
        <DashboardLayout>{children}</DashboardLayout>
      </DashboardProvider>
    </NextAuthProvider>
  );
}
