"use client";

import { Button } from "@usesend/ui/src/button";
import { Download, FileText, LifeBuoy } from "lucide-react";

/**
 * Saidas de ajuda da etapa de DNS — a que mais trava o lojista. Aparece no
 * wizard e na tela do dominio, porque quem ja terminou o onboarding tambem
 * precisa disso ao reconfigurar.
 */
export function DnsInstructionsActions({
  domainId,
  className,
}: {
  domainId: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      <Button asChild variant="outline" size="sm">
        <a href={`/api/domains/${domainId}/instructions?format=md`} download>
          <Download className="mr-2 h-4 w-4" />
          Baixar instruções (.md)
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a
          href={`/api/domains/${domainId}/instructions?format=print`}
          target="_blank"
          rel="noreferrer"
        >
          <FileText className="mr-2 h-4 w-4" />
          Gerar PDF para o técnico
        </a>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <a
          href="https://docs.madmail.com.br/guides/dominios"
          target="_blank"
          rel="noreferrer"
        >
          <LifeBuoy className="mr-2 h-4 w-4" />
          Como faço no meu provedor?
        </a>
      </Button>
    </div>
  );
}
