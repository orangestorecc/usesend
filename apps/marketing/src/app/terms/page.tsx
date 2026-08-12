import type { Metadata } from "next";
import { Redirecionamento } from "~/components/Redirecionamento";

// Endereço antigo, herdado do projeto de origem. Mantido só para não quebrar
// link já compartilhado; o conteúdo vive em /termos.
export const metadata: Metadata = {
  title: "Termos de Uso — Madmail",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.madmail.com.br/termos" },
  other: { refresh: "0; url=/termos" },
};

export default function TermsRedirect() {
  return <Redirecionamento para="/termos" titulo="os Termos de Uso" />;
}
