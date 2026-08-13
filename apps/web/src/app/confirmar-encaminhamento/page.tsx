import { confirmarDestino } from "~/server/service/forwarding-service";

export const dynamic = "force-dynamic";

export default async function ConfirmarEncaminhamento({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const resultado = token ? await confirmarDestino(token) : { ok: false as const };

  const titulo = resultado.ok
    ? resultado.jaConfirmado
      ? "Este encaminhamento já estava confirmado"
      : "Encaminhamento confirmado"
    : "Link inválido ou já utilizado";

  const texto = resultado.ok
    ? `A partir de agora os e-mails recebidos são encaminhados para ${resultado.destino}. Para parar, peça a quem configurou que remova a regra no Madmail.`
    : "O link de confirmação não vale mais. Peça a quem configurou o encaminhamento para reenviar a confirmação.";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border p-8 text-center">
        <h1 className="text-xl font-semibold">{titulo}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{texto}</p>
      </div>
    </main>
  );
}
