import React from "react";
import { Container, Text } from "jsx-email";
import { render } from "jsx-email";
import { EmailLayout } from "./components/EmailLayout";
import { EmailHeader } from "./components/EmailHeader";
import { EmailFooter } from "./components/EmailFooter";
import { EmailButton } from "./components/EmailButton";

interface UsageWarningEmailProps {
  teamName: string;
  used: number;
  limit: number;
  isPaidPlan: boolean;
  period?: "daily" | "monthly";
  manageUrl?: string;
  logoUrl?: string;
}

export function UsageWarningEmail({
  teamName,
  used,
  limit,
  isPaidPlan,
  period = "daily",
  manageUrl = "#",
  logoUrl,
}: UsageWarningEmailProps) {
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 80;
  const periodLabel = period === "monthly" ? "mensal" : "diário";
  const preview = `Você já usou ${percent}% do seu limite ${periodLabel} de e-mails`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader
        logoUrl={logoUrl}
        title="Você está chegando ao seu limite de e-mails"
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
          Você já usou{" "}
          <strong style={{ color: "#000" }}>{used.toLocaleString()}</strong> do
          seu limite {periodLabel} de{" "}
          <strong style={{ color: "#000" }}>{limit.toLocaleString()}</strong>{" "}
          e-mails.
        </Text>

        <Container
          style={{
            backgroundColor: "#fff7ed",
            border: "1px solid #fed7aa",
            padding: "12px 16px",
            margin: "0 0 24px 0",
            borderRadius: "4px",
          }}
        >
          <Text
            style={{
              margin: 0,
              color: "#9a3412",
              fontSize: 14,
              textAlign: "left" as const,
            }}
          >
            Atenção: você está em aproximadamente {percent}% do seu limite.
          </Text>
        </Container>

        <Container style={{ margin: "0 0 32px 0", textAlign: "left" as const }}>
          <EmailButton href={manageUrl}>
            {isPaidPlan ? "Verificar time" : "Fazer upgrade"}
          </EmailButton>
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
            ? "verificar seu time respondendo a este e-mail"
            : "fazer upgrade do seu plano"}
        </Text>
      </Container>

      <EmailFooter />
    </EmailLayout>
  );
}

export async function renderUsageWarningEmail(
  props: UsageWarningEmailProps
): Promise<string> {
  return render(<UsageWarningEmail {...props} />);
}
