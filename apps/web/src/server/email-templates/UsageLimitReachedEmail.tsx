import React from "react";
import { Container, Text } from "jsx-email";
import { render } from "jsx-email";
import { EmailLayout } from "./components/EmailLayout";
import { EmailHeader } from "./components/EmailHeader";
import { EmailFooter } from "./components/EmailFooter";
import { EmailButton } from "./components/EmailButton";

interface UsageLimitReachedEmailProps {
  teamName: string;
  limit: number;
  isPaidPlan: boolean;
  period?: "daily" | "monthly";
  manageUrl?: string;
  logoUrl?: string;
}

export function UsageLimitReachedEmail({
  teamName,
  limit,
  isPaidPlan,
  period = "daily",
  manageUrl = "#",
  logoUrl,
}: UsageLimitReachedEmailProps) {
  const periodLabel = period === "monthly" ? "mensal" : "diário";
  const preview = `Você atingiu seu limite ${periodLabel} de e-mails`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader
        logoUrl={logoUrl}
        title="Você atingiu seu limite de e-mails"
      />

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
          Olá, time {teamName},
        </Text>

        <Text
          style={{
            fontSize: "16px",
            color: "#374151",
            margin: "0 0 16px 0",
            lineHeight: "1.6",
            textAlign: "left" as const,
          }}
        >
          Você atingiu seu limite {periodLabel} de{" "}
          <strong style={{ color: "#000" }}>{limit.toLocaleString()}</strong>{" "}
          e-mails.
        </Text>

        <Container
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "12px 16px",
            margin: "0 0 24px 0",
            borderRadius: "4px",
          }}
        >
          <Text
            style={{
              margin: 0,
              color: "#991b1b",
              fontSize: 14,
              textAlign: "left" as const,
            }}
          >
            O envio está pausado temporariamente até seu limite ser reiniciado
            ou{" "}
            {isPaidPlan
              ? "seu workspace ser verificado"
              : "seu plano receber upgrade"}
          </Text>
        </Container>

        <Container style={{ margin: "0 0 32px 0", textAlign: "left" as const }}>
          <EmailButton href={manageUrl}>Gerenciar plano</EmailButton>
        </Container>

        <Text
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: 0,
            lineHeight: 1.5,
            textAlign: "left" as const,
          }}
        >
          Considere{" "}
          {isPaidPlan
            ? "verificar seu workspace respondendo a este e-mail"
            : "fazer upgrade do seu plano"}
        </Text>
      </Container>

      <EmailFooter />
    </EmailLayout>
  );
}

export async function renderUsageLimitReachedEmail(
  props: UsageLimitReachedEmailProps
): Promise<string> {
  return render(<UsageLimitReachedEmail {...props} />);
}
