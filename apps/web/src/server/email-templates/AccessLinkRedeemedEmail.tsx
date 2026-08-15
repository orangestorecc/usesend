import React from "react";
import { Container, Text } from "jsx-email";
import { render } from "jsx-email";
import { EmailLayout } from "./components/EmailLayout";
import { EmailHeader } from "./components/EmailHeader";
import { EmailFooter } from "./components/EmailFooter";

interface AccessLinkRedeemedEmailProps {
  /** Quem liberou o acesso (nome, ou e-mail quando não há nome). */
  quemLiberou: string;
  /** Workspace de onde o acesso saiu — a sessão só vale dentro dele. */
  nomeDoWorkspace: string;
  /** Momento do resgate, já formatado em pt-BR. */
  quando: string;
  /** Duração da sessão criada pelo link. Vem de `ACCESS_LINK_SESSAO_HORAS`. */
  horasDeSessao: number;
  nome?: string | null;
  logoUrl?: string;
}

const paragrafo = {
  fontSize: "16px",
  color: "#374151",
  margin: "0 0 24px 0",
  lineHeight: "1.6",
  textAlign: "left" as const,
};

/**
 * Aviso de transparência, não alarme. Quem tem a conta acessada precisa saber
 * que alguém entrou — inclusive quando o admin usou "copiar link" e o link
 * nunca passou pela caixa de entrada dela.
 */
export function AccessLinkRedeemedEmail({
  quemLiberou,
  nomeDoWorkspace,
  quando,
  horasDeSessao,
  nome,
  logoUrl,
}: AccessLinkRedeemedEmailProps) {
  return (
    <EmailLayout
      preview={`Um link de acesso à sua conta foi usado no workspace ${nomeDoWorkspace}`}
    >
      <EmailHeader
        logoUrl={logoUrl}
        title="Alguém entrou na sua conta com um link de acesso"
      />

      <Container style={{ padding: "20px 0", textAlign: "left" as const }}>
        <Text style={paragrafo}>{nome ? `Olá, ${nome},` : "Olá,"}</Text>

        <Text style={paragrafo}>
          Um link de acesso à sua conta Madmail foi usado em {quando}. O acesso
          foi liberado por <strong>{quemLiberou}</strong> e vale apenas dentro
          do workspace <strong>{nomeDoWorkspace}</strong>.
        </Text>

        <Text style={paragrafo}>
          A sessão criada por esse link dura {horasDeSessao} horas e expira
          sozinha. Tudo o que for feito nela fica registrado na auditoria do
          workspace, com a identificação de quem liberou o acesso.
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
          Se você combinou esse acesso, não precisa fazer nada. Se não
          reconhece {quemLiberou} nem o workspace {nomeDoWorkspace}, avise nosso
          suporte em{" "}
          <a href="mailto:suporte@madmail.com.br" style={{ color: "#374151" }}>
            suporte@madmail.com.br
          </a>
          .
        </Text>
      </Container>

      <EmailFooter />
    </EmailLayout>
  );
}

export async function renderAccessLinkRedeemedEmail(
  props: AccessLinkRedeemedEmailProps,
): Promise<string> {
  return render(<AccessLinkRedeemedEmail {...props} />);
}
