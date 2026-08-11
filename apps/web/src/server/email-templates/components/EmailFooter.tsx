import React from "react";
import { Container, Text } from "jsx-email";

interface EmailFooterProps {
  companyName?: string;
  supportUrl?: string;
}

export function EmailFooter({
  companyName = "Madmail",
  supportUrl = "mailto:suporte@madmail.com.br",
}: EmailFooterProps) {
  return (
    <Container
      style={{
        padding: "20px 0",
        backgroundColor: "#ffffff",
      }}
    >
      <Text
        style={{
          fontSize: "14px",
          color: "#6b7280",
          textAlign: "left" as const,
          margin: "0",
          lineHeight: "1.5",
        }}
      >
        Este e-mail foi enviado por {companyName}. Se você tiver alguma dúvida,{" "}
        <a
          href={supportUrl}
          style={{
            color: "#000000",
            textDecoration: "underline",
          }}
        >
          fale com nosso time de suporte
        </a>
        .
      </Text>
    </Container>
  );
}
