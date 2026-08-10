import React from "react";
import { Container, Text } from "jsx-email";
import { render } from "jsx-email";
import { EmailLayout } from "./components/EmailLayout";
import { EmailHeader } from "./components/EmailHeader";
import { EmailFooter } from "./components/EmailFooter";
import { EmailButton } from "./components/EmailButton";

interface OtpEmailProps {
  otpCode: string;
  loginUrl: string;
  hostName?: string;
  logoUrl?: string;
}

export function OtpEmail({
  otpCode,
  loginUrl,
  hostName = "Madmail",
  logoUrl,
}: OtpEmailProps) {
  return (
    <EmailLayout preview={`Seu código de verificação: ${otpCode}`}>
      <EmailHeader logoUrl={logoUrl} title="Entre na sua conta" />

      <Container style={{ padding: "20px 0", textAlign: "left" as const }}>
        <Text
          style={{
            fontSize: "16px",
            color: "#374151",
            margin: "0 0 24px 0",
            lineHeight: "1.6",
            textAlign: "left" as const,
          }}
        >
          Olá,
        </Text>

        <Text
          style={{
            fontSize: "16px",
            color: "#374151",
            margin: "0 0 32px 0",
            lineHeight: "1.6",
            textAlign: "left" as const,
          }}
        >
          Use o código de verificação abaixo para entrar na sua conta Madmail:
        </Text>

        <Container
          style={{
            backgroundColor: "#f8f9fa",
            padding: "16px",
            margin: "0 0 32px 0",
            textAlign: "left" as const,
          }}
        >
          <Text
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#000000",
              letterSpacing: "4px",
              margin: "0",
              fontFamily: "monospace",
              textAlign: "left" as const,
            }}
          >
            {otpCode}
          </Text>
        </Container>

        <Container style={{ margin: "0 0 32px 0", textAlign: "left" as const }}>
          <EmailButton href={loginUrl}>Entrar com um clique</EmailButton>
        </Container>

        <Text
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "0",
            lineHeight: "1.5",
            textAlign: "left" as const,
          }}
        >
          Se você não solicitou este e-mail, pode ignorá-lo com segurança. O
          código de verificação expira automaticamente.
        </Text>
      </Container>

      <EmailFooter />
    </EmailLayout>
  );
}

export async function renderOtpEmail(props: OtpEmailProps): Promise<string> {
  return render(<OtpEmail {...props} />);
}
