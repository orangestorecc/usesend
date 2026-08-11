"use client";

/**
 * Último recuo do App Router: pega o erro que derrubou até o layout raiz.
 *
 * Como substitui o `layout.tsx`, precisa trazer `<html>` e `<body>` próprios —
 * e por isso não tem acesso ao ThemeProvider nem às fontes, o que mantém o
 * estilo aqui deliberadamente cru.
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-black text-neutral-100">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-medium">Algo deu errado</h1>
          <p className="max-w-md text-sm text-neutral-400">
            A falha foi registrada e já estamos olhando. Você pode tentar de
            novo.
          </p>
          {error.digest ? (
            <code className="text-xs text-neutral-500">{error.digest}</code>
          ) : null}
          <button
            onClick={reset}
            className="mt-2 rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-900"
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
