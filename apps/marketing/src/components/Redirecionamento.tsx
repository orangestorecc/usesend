import Link from "next/link";

/**
 * Página-ponte para endereço antigo.
 *
 * O site é exportado estático, então `redirects()` do next.config não vale —
 * ele depende de servidor. Aqui a troca é feita por meta refresh, que funciona
 * em arquivo estático, com um link visível para quem tiver JavaScript ou
 * refresh bloqueado. Existe só para não quebrar link já compartilhado.
 */
export function Redirecionamento({
  para,
  titulo,
}: {
  para: string;
  titulo: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
      <div>
        <p className="text-sm text-muted-foreground">
          Esta página mudou de endereço.
        </p>
        <Link href={para} className="mt-2 inline-block text-lg underline">
          Ir para {titulo}
        </Link>
      </div>
    </main>
  );
}
