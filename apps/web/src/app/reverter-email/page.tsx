import Link from "next/link";

import { reverterTrocaDeEmail } from "~/server/service/email-change-service";

/**
 * Reversão da troca de e-mail. Fica fora do dashboard porque a operação
 * derruba todas as sessões — quem chega aqui pelo link do e-mail antigo
 * quase nunca está logado.
 */
export default async function ReverterEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <Aviso titulo="Link inválido" texto="O link não trouxe o token." />;
  }

  try {
    const { email } = await reverterTrocaDeEmail(token);
    return (
      <Aviso
        titulo="Troca revertida"
        texto={`O e-mail de acesso voltou a ser ${email}. Por segurança, todas as sessões foram encerradas e qualquer conta Google ou GitHub vinculada depois da troca foi removida. Entre de novo para continuar.`}
      />
    );
  } catch {
    return (
      <Aviso
        titulo="Não foi possível reverter"
        texto="Este link é inválido, já foi usado ou passou do prazo de 7 dias. Se você não reconhece a troca, fale com o suporte."
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
