import type { Metadata } from "next";
import { Redirecionamento } from "~/components/Redirecionamento";

// Endereço antigo, herdado do projeto de origem. Mantido só para não quebrar
// link já compartilhado; o conteúdo vive em /privacidade.
export const metadata: Metadata = {
  title: "Política de Privacidade — Madmail",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.madmail.com.br/privacidade" },
  other: { refresh: "0; url=/privacidade" },
};

export default function PrivacyRedirect() {
  return <Redirecionamento para="/privacidade" titulo="a Política de Privacidade" />;
}
