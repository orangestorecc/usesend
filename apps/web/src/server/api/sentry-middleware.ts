import * as Sentry from "@sentry/nextjs";
import { TRPCError } from "@trpc/server";

import { UnsendApiError } from "~/server/public-api/api-error";

/**
 * Códigos que representam uso incorreto da API pelo cliente, não defeito do
 * servidor. Chegam o tempo todo em operação normal (sessão expirada, registro
 * já removido, formulário inválido) e só sujariam o Sentry.
 */
const ESPERADOS = new Set<string>([
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

  // Equivalentes do UnsendApiError, que usa um enum próprio. `NOT_UNIQUE` é o
  // 409 do tRPC, `RATE_LIMITED` o 429 e `METHOD_NOT_ALLOWED` o 405.
  // `INTERNAL_SERVER_ERROR` fica de fora de propósito: esse é defeito real.
  "NOT_UNIQUE",
  "RATE_LIMITED",
  "METHOD_NOT_ALLOWED",
]);

function deveReportar(erro: unknown): boolean {
  if (erro instanceof TRPCError) {
    // Um INTERNAL_SERVER_ERROR embrulhando uma exceção real interessa; um
    // NOT_FOUND lançado de propósito pelo router, não.
    return !ESPERADOS.has(erro.code);
  }

  // Os services são compartilhados entre a API pública (Hono) e o tRPC, então
  // uma validação de entrada chega aqui como UnsendApiError, não TRPCError.
  // Sem esta verificação, "e-mail de remetente inválido" — que é o usuário
  // digitando errado — virava issue no Sentry como se fosse defeito.
  if (erro instanceof UnsendApiError) {
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
