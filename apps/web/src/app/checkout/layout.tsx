import { NextAuthProvider } from "~/providers/next-auth";

export const dynamic = "force-dynamic";

/**
 * O checkout fica fora do grupo (dashboard), então precisa do próprio
 * SessionProvider — sem ele o useSession() da página quebra no render.
 */
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NextAuthProvider>{children}</NextAuthProvider>;
}
