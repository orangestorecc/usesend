import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "~/server/auth";
import { NextAuthProvider } from "~/providers/next-auth";
import { EscolherWorkspace } from "./escolher-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Escolher workspace",
};

// A página está fora do grupo `(dashboard)` e o app não tem `middleware.ts`:
// sem esta checagem, um deslogado abre a URL, a query volta UNAUTHORIZED e ele
// fica num beco sem saída, sem link para o login.
export default async function EscolherWorkspacePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <NextAuthProvider>
      <EscolherWorkspace />
    </NextAuthProvider>
  );
}
