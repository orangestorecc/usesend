"use client";

import { useEffect } from "react";

// Página antiga: o conteúdo agora vive em . Export estático não faz
// redirect no servidor, então redirecionamos no cliente e deixamos o link.
export default function RedirecionaLegal() {
  useEffect(() => {
    window.location.replace("");
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">
        Este documento mudou de endereço.{" "}
        <a href="" className="underline">Ir para a nova página</a>
      </p>
    </main>
  );
}
