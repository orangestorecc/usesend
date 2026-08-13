import Link from "next/link";

import { cancelarResetDeMfa } from "~/server/service/mfa-reset-service";

/**
 * Cancelamento do reset de MFA pelo próprio dono da conta. Fora do dashboard
 * porque quem está sendo alvo de engenharia social pode não conseguir entrar.
 */
export default async function CancelarResetMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <Aviso titulo="Link inválido" texto="O link não trouxe o token." />;
  }

  try {
    await cancelarResetDeMfa(token);
    return (
      <Aviso
        titulo="Pedido cancelado"
        texto="A confirmação por e-mail da sua conta continua ativa. Se você não reconhece este pedido, troque a senha das suas contas Google/GitHub e fale com o suporte."
      />
    );
  } catch {
    return (
      <Aviso
        titulo="Não foi possível cancelar"
        texto="Este link é inválido ou o pedido já foi resolvido. Fale com o suporte."
      />
    );
  }
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-lg border p-6 text-center">
        <h1 className="text-lg font-medium">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
        <Link href="/login" className="mt-4 inline-block text-sm underline">
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
