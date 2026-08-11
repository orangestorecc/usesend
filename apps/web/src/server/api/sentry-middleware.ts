import * as Sentry from "@sentry/nextjs";
import { TRPCError } from "@trpc/server";

/**
 * Códigos que representam uso incorreto da API pelo cliente, não defeito do
 * servidor. Chegam o tempo todo em operação normal (sessão expirada, registro
 * já removido, formulário inválido) e só sujariam o Sentry.
 */
const ESPERADOS = new Set<TRPCError["code"]>([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
  "PARSE_ERROR",
  "METHOD_NOT_SUPPORTED",
  "UNPROCESSABLE_CONTENT",
]);

function deveReportar(erro: unknown): boolean {
  if (erro instanceof TRPCError) {
    // Um INTERNAL_SERVER_ERROR embrulhando uma exceção real interessa; um
    // NOT_FOUND lançado de propósito pelo router, não.
    return !ESPERADOS.has(erro.code);
  }
  return true;
}

/**
 * Reporta ao Sentry as falhas inesperadas de qualquer procedure tRPC.
 *
 * Fica na base (`publicProcedure` / `authedProcedure`), então todas as
 * procedures derivadas herdam sem precisar de nada nos routers.
 */
export function criarSentryMiddleware<T extends { path: string; type: string }>() {
  return async function sentryMiddleware(opts: T & { next: () => Promise<any> }) {
    const resultado = await opts.next();

    if (!resultado.ok && deveReportar(resultado.error)) {
      Sentry.withScope((scope) => {
        scope.setTag("trpc.path", opts.path);
        scope.setTag("trpc.type", opts.type);
        // A causa original carrega o stack útil; o TRPCError é só o invólucro.
        const erro =
          resultado.error instanceof TRPCError && resultado.error.cause
            ? resultado.error.cause
            : resultado.error;
        Sentry.captureException(erro);
      });
    }

    return resultado;
  };
}
