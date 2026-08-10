import React from "react";
import { Container, Text } from "jsx-email";
import { render } from "jsx-email";
import { DomainStatus } from "@prisma/client";
import { EmailButton } from "~/server/email-templates/components/EmailButton";
import { EmailFooter } from "~/server/email-templates/components/EmailFooter";
import { EmailHeader } from "~/server/email-templates/components/EmailHeader";
import { EmailLayout } from "~/server/email-templates/components/EmailLayout";

interface DomainVerificationStatusEmailProps {
  domainName: string;
  currentStatus: DomainStatus;
  previousStatus: DomainStatus;
  domainUrl: string;
}

function formatDomainStatus(status: DomainStatus) {
  return status.toLowerCase().replaceAll("_", " ");
}

function getTitle(currentStatus: DomainStatus, previousStatus: DomainStatus) {
  if (currentStatus === DomainStatus.SUCCESS) {
    return previousStatus === DomainStatus.SUCCESS
      ? "Verificação do domínio conferida"
      : "Seu domínio foi verificado";
  }

  if (previousStatus === DomainStatus.SUCCESS) {
    return "O status do seu domínio mudou";
  }

  return "A verificação do seu domínio precisa de atenção";
}

export function DomainVerificationStatusEmail({
  domainName,
  currentStatus,
  previousStatus,
  domainUrl,
}: DomainVerificationStatusEmailProps) {
  const isSuccess = currentStatus === DomainStatus.SUCCESS;
  const preview = `${domainName} agora está ${formatDomainStatus(currentStatus)}`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader title={getTitle(currentStatus, previousStatus)} />

      <Container style={{ padding: "20px 0", textAlign: "left" as const }}>
        <Text
          style={{
            fontSize: "16px",
            color: "#374151",
            margin: "0 0 16px 0",
            lineHeight: "1.6",
            textAlign: "left" as const,
          }}
        >
          Olá,
        </Text>

        {isSuccess ? (
          <Text
            style={{
              fontSize: "15px",
              color: "#4b5563",
              margin: "0 0 16px 0",
              lineHeight: "1.6",
              textAlign: "left" as const,
            }}
          >
            Seu domínio <strong>{domainName}</strong> foi verificado e você já
            pode começar a enviar e-mails.
          </Text>
        ) : (
          <Text
            style={{
              fontSize: "15px",
              color: "#4b5563",
              margin: "0 0 16px 0",
              lineHeight: "1.6",
              textAlign: "left" as const,
            }}
          >
            Seu domínio <strong>{domainName}</strong> não pôde ser verificado
            porque os registros DNS ainda não estão configurados corretamente.
            Revise suas configurações de DNS e tente novamente.
          </Text>
        )}

        <Text
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "0 0 24px 0",
            lineHeight: "1.6",
            textAlign: "left" as const,
          }}
        >
          Abra as configurações do seu domínio para revisar os registros e os
          detalhes da verificação.
        </Text>

        <Container style={{ margin: "0 0 32px 0", textAlign: "left" as const }}>
          <EmailButton href={domainUrl}>
            Abrir configurações do domínio
          </EmailButton>
        </Container>

        <Text
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "0",
            lineHeight: "1.6",
            textAlign: "left" as const,
          }}
        >
          Obrigado,
          <br />
          Time Madmail
        </Text>
      </Container>

      <EmailFooter />
    </EmailLayout>
  );
}

export async function renderDomainVerificationStatusEmail(
  props: DomainVerificationStatusEmailProps,
): Promise<string> {
  return render(<DomainVerificationStatusEmail {...props} />);
}
