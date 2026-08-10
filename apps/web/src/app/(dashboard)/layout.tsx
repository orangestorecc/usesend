import { cookies } from "next/headers";
import { DashboardProvider } from "~/providers/dashboard-provider";
import { NextAuthProvider } from "~/providers/next-auth";
import { DashboardLayout } from "./dasboard-layout";

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

export default function AuthenticatedDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthProvider>
      <DashboardProvider>
        <ImpersonationBanner />
        <DashboardLayout>{children}</DashboardLayout>
      </DashboardProvider>
    </NextAuthProvider>
  );
}
