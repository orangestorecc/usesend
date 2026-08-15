import React from "react";
import { Container, Text } from "jsx-email";
import { render } from "jsx-email";
import { EmailLayout } from "./components/EmailLayout";
import { EmailHeader } from "./components/EmailHeader";
import { EmailFooter } from "./components/EmailFooter";
import { EmailButton } from "./components/EmailButton";

interface AccessLinkEmailProps {
  accessUrl: string;
  minutosDeValidade: number;
  nome?: string | null;
  logoUrl?: string;
  /**
   * Quem liberou o acesso (nome, ou e-mail quando não há nome). Sem isso o
   * e-mail vira phishing genérico: ninguém consegue conferir se o pedido é
   * legítimo.
   */
  quemLiberou: string;
  /** Workspace de onde o acesso saiu — o link só vale dentro dele. */
  nomeDoWorkspace: string;
}

const paragrafo = {
  fontSize: "16px",
  color: "#374151",
  margin: "0 0 24px 0",
  lineHeight: "1.6",
  textAlign: "left" as const,
};

export function AccessLinkEmail({
  accessUrl,
  minutosDeValidade,
  nome,
  logoUrl,
  quemLiberou,
  nomeDoWorkspace,
}: AccessLinkEmailProps) {
  return (
    <EmailLayout
      preview={`${quemLiberou} liberou seu acesso ao workspace ${nomeDoWorkspace}`}
    >
      <EmailHeader
        logoUrl={logoUrl}
        title={`Seu acesso ao workspace ${nomeDoWorkspace}`}
      />

      <Container style={{ padding: "20px 0", textAlign: "left" as const }}>
        <Text style={paragrafo}>{nome ? `Olá, ${nome},` : "Olá,"}</Text>

        <Text style={paragrafo}>
          <strong>{quemLiberou}</strong> liberou um acesso rápido para você no
          workspace <strong>{nomeDoWorkspace}</strong>, no Madmail. Clique no
          botão abaixo e você entra direto nesse workspace, sem senha — o
          Madmail não usa senha.
        </Text>

        <Container style={{ margin: "0 0 32px 0", textAlign: "left" as const }}>
          <EmailButton href={accessUrl}>Entrar no Madmail</EmailButton>
        </Container>

        <Text style={{ ...paragrafo, fontSize: "14px", color: "#6b7280" }}>
          O link vale por {minutosDeValidade} minutos e funciona uma única vez.
          Depois disso ele perde a validade e você precisa de um novo.
        </Text>

        <Text
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "0",
            lineHeight: "1.5",
            textAlign: "left" as const,
          }}
        >
          Não repasse este link para ninguém: quem abrir entra na sua conta. Se
          você não pediu este acesso — ou não conhece {quemLiberou} nem o
          workspace {nomeDoWorkspace} —, não clique e avise nosso suporte em{" "}
          <a href="mailto:suporte@madmail.com.br" style={{ color: "#374151" }}>
            suporte@madmail.com.br
          </a>
          . Ignorar não basta: alguém pediu esse acesso em seu nome.
        </Text>
      </Container>

      <EmailFooter />
    </EmailLayout>
  );
}

export async function renderAccessLinkEmail(
  props: AccessLinkEmailProps,
): Promise<string> {
  return render(<AccessLinkEmail {...props} />);
}
