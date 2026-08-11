import { NextResponse, type NextRequest } from "next/server";

/**
 * Roteamento por domínio.
 *
 * O proxy reverso da infra manda `app.` e `www.` para a mesma porta, então é
 * aqui que separamos: requisição chegando pelos domínios do site institucional
 * é reescrita para o servidor estático que serve o export de `apps/marketing`.
 *
 * Configuração por ambiente (ausentes => middleware não faz nada):
 *   MARKETING_ORIGIN = http://127.0.0.1:3001
 *   MARKETING_HOSTS  = www.madmail.com.br,madmail.com.br
 */
const MARKETING_ORIGIN = process.env.MARKETING_ORIGIN;
const MARKETING_HOSTS = (process.env.MARKETING_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function middleware(req: NextRequest) {
  if (!MARKETING_ORIGIN || MARKETING_HOSTS.length === 0) {
    return NextResponse.next();
  }

  const host = (req.headers.get("host") ?? "").split(":")[0]?.toLowerCase();
  if (!host || !MARKETING_HOSTS.includes(host)) {
    return NextResponse.next();
  }

  // Inclui o caminho e a query; os assets do site (/_next/static/...) também
  // passam por aqui, senão o export estático carregaria sem CSS nem JS.
  const target = new URL(
    req.nextUrl.pathname + req.nextUrl.search,
    MARKETING_ORIGIN,
  );
  return NextResponse.rewrite(target);
}

export const config = {
  // Precisa cobrir tudo: o site institucional tem os próprios assets em
  // /_next/static, que seriam perdidos se fossem excluídos daqui.
  matcher: ["/:path*"],
};
