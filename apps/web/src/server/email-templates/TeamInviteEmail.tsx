import React from "react";
import { Container, Text } from "jsx-email";
import { render } from "jsx-email";
import { EmailLayout } from "./components/EmailLayout";
import { EmailHeader } from "./components/EmailHeader";
import { EmailFooter } from "./components/EmailFooter";
import { EmailButton } from "./components/EmailButton";

interface TeamInviteEmailProps {
  teamName: string;
  inviteUrl: string;
  inviterName?: string;
  logoUrl?: string;
  role?: string;
}

export function TeamInviteEmail({
  teamName,
  inviteUrl,
  inviterName,
  logoUrl,
  role = "member",
}: TeamInviteEmailProps) {
  return (
    <EmailLayout preview={`Você foi convidado para entrar em ${teamName} no Madmail`}>
      <EmailHeader logoUrl={logoUrl} title="Você foi convidado!" />

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
          {inviterName
            ? `${inviterName} convidou você para entrar em `
            : "Você foi convidado para entrar em "}
          <strong style={{ color: "#000000" }}>{teamName}</strong> no Madmail
          {role && role !== "member" && (
            <span>
              {" "}
              como <strong style={{ color: "#000000" }}>{role}</strong>
            </span>
          )}
          .
        </Text>

        <Container style={{ margin: "0 0 32px 0", textAlign: "left" as const }}>
          <EmailButton href={inviteUrl}>Aceitar convite</EmailButton>
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
          Se você não esperava este convite ou não quer entrar neste time, pode
          ignorar este e-mail com segurança.
        </Text>
      </Container>

      <EmailFooter />
    </EmailLayout>
  );
}

export async function renderTeamInviteEmail(
  props: TeamInviteEmailProps
): Promise<string> {
  return render(<TeamInviteEmail {...props} />);
}
