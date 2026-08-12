"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Aviso sobre o estado dos domínios do time.
 *
 * Sem domínio verificado não existe endereço de remetente válido — deixar a
 * pessoa preencher o formulário e falhar no fim é o comportamento que
 * queremos eliminar.
 */
export type EstadoDominios = "carregando" | "nenhum" | "em-verificacao" | "ok";

export function estadoDosDominios(
  dominios: { name: string; status: string }[] | undefined,
  carregando: boolean,
): EstadoDominios {
  if (carregando || !dominios) return "carregando";
  if (dominios.some((d) => d.status === "SUCCESS")) return "ok";
  if (dominios.length === 0) return "nenhum";
  return "em-verificacao";
}

export default function DomainStatusAlert({
  estado,
  dominios,
}: {
  estado: EstadoDominios;
  dominios?: { name: string; status: string }[];
}) {
  if (estado === "ok" || estado === "carregando") return null;

  const emVerificacao = dominios?.[0]?.name;

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        {estado === "nenhum"
          ? "Você ainda não tem domínio verificado"
          : "Seu domínio ainda está em verificação"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {estado === "nenhum"
          ? "Para enviar campanhas é preciso verificar um domínio seu — é ele que autoriza a Madmail a enviar em seu nome."
          : `O domínio ${emVerificacao ?? ""} ainda não terminou a verificação. Enquanto isso, não é possível enviar.`}{" "}
        <Link href="/domains" className="underline">
          {estado === "nenhum" ? "Adicionar domínio" : "Ver domínios"}
        </Link>
      </p>
    </div>
  );
}
