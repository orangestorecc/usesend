import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "~/server/db";
import { env } from "~/env";

// Docker builds skip environment validation, so this module can be evaluated
// without NEXTAUTH_URL while Next.js collects route data. Runtime validation
// still requires the URL in production.
const isSecure = env.NEXTAUTH_URL?.startsWith("https") ?? false;
const SESSION_COOKIE = isSecure
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";
const IMPERSONATOR_COOKIE = "madmail-impersonator";

/** Volta da impersonation para a conta do admin. */
export async function GET() {
  const cookieStore = await cookies();
  const original = cookieStore.get(IMPERSONATOR_COOKIE)?.value;
  const current = cookieStore.get(SESSION_COOKIE)?.value;

  const res = NextResponse.redirect(new URL("/admin/teams", env.NEXTAUTH_URL));

  // Remove a sessão temporária de impersonation.
  if (current && current !== original) {
    await db.session
      .deleteMany({ where: { sessionToken: current } })
      .catch(() => undefined);
  }

  if (original) {
    res.cookies.set(SESSION_COOKIE, original, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
    });
  } else {
    res.cookies.delete(SESSION_COOKIE);
  }
  res.cookies.delete(IMPERSONATOR_COOKIE);
  return res;
}
