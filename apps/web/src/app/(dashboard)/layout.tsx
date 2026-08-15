import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { avaliarGate } from "~/server/service/mfa-service";
import { WORKSPACE_COOKIE } from "~/server/service/active-team";
import { ACCESS_LINK_SESSAO_HORAS } from "~/server/service/access-link-service";
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
 * Sessão nascida de um link de acesso: vale só para o workspace que emitiu o
 * link. O aviso é permanente de propósito — quem entrou por aqui precisa saber
 * que não está na sua conta "normal" antes de disparar qualquer campanha.
 *
 * Sinal consumido: cookie `madmail-access-link` (mesmo formato do
 * `madmail-impersonator`), gravado pela nossa rota de resgate com o nome do
 * workspace emissor como valor. É APRESENTAÇÃO e só — a autoridade sobre o
 * acesso é a coluna `Session.accessLinkTeamId`, lida no banco a cada request
 * (`lerTravaDeLinkDeAcesso`). Nunca decida permissão a partir deste cookie.
 */
async function AccessLinkBanner() {
  const cookieStore = await cookies();
  const sinal = cookieStore.get("madmail-access-link");
  if (!sinal) return null;

  const workspace = sinal.value ? decodeURIComponent(sinal.value) : null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-sky-600 px-4 py-2 text-center text-sm text-white">
      Você entrou por um link de acesso
      {workspace ? `: esta sessão vale só no workspace ${workspace}` : ""}, dura{" "}
      {ACCESS_LINK_SESSAO_HORAS}h e tudo o que for feito aqui fica registrado no
      histórico de auditoria.
      <a href="/login" className="font-semibold underline">
        Entrar com sua conta
      </a>
    </div>
  );
}

/**
 * Cookie de apresentação escrito no resgate do link de acesso. Vale só para
 * esconder o seletor de workspace e mostrar o aviso; a trava de verdade é
 * `Session.accessLinkTeamId`, checada no servidor em toda procedure.
 */
async function sessaoPresaAWorkspace() {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get("madmail-access-link"));
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

  // O workspace ativo mora num cookie do servidor. Ler aqui (e não no browser)
  // mantém a decisão válida mesmo se o cookie for httpOnly.
  const cookieStore = await cookies();
  const cru = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const numero = cru ? Number(cru) : NaN;
  const workspaceAtivo = Number.isInteger(numero) && numero > 0 ? numero : null;

  return (
    <NextAuthProvider>
      <DashboardProvider
        workspaceAtivo={workspaceAtivo}
        acessoPresoAoWorkspace={await sessaoPresaAWorkspace()}
      >
        <ImpersonationBanner />
        <AccessLinkBanner />
        <BillingBanner />
        <DashboardLayout>{children}</DashboardLayout>
      </DashboardProvider>
    </NextAuthProvider>
  );
}
