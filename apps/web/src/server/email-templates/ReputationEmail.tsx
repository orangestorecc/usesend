import React from "react";
import { Container, Text } from "jsx-email";
import { render } from "jsx-email";
import { EmailLayout } from "./components/EmailLayout";
import { EmailHeader } from "./components/EmailHeader";
import { EmailFooter } from "./components/EmailFooter";
import { EmailButton } from "./components/EmailButton";

/**
 * Régua de comunicação do controle de bounce.
 * Regra de copy (docs-spec/BOUNCE-CONTROL-SPEC.md §5): nenhum e-mail atribui
 * culpa. Todos dizem o número, a faixa e o próximo passo — e todos deixam claro
 * que o acesso ao painel continua.
 */
export type ReputationEmailKind =
  | "warning"
  | "critical"
  | "blocked"
  | "blocked_reminder"
  | "supervised"
  | "recovered";

interface ReputationEmailProps {
  kind: ReputationEmailKind;
  teamName: string;
  bounceRate: number;
  blockRate: number;
  sampleSize: number;
  supervisedLimit?: number;
  supervisedUntil?: string;
  reputationUrl: string;
  supportUrl: string;
  logoUrl?: string;
}

const COPY: Record<
  ReputationEmailKind,
  {
    title: string;
    lead: (p: ReputationEmailProps) => string;
    body: (p: ReputationEmailProps) => string[];
    cta: string;
    tone: "neutral" | "attention" | "stop" | "good";
  }
> = {
  warning: {
    title: "Sua taxa de retorno subiu um pouco",
    lead: (p) =>
      `A taxa de retorno do workspace ${p.teamName} está em ${p.bounceRate.toFixed(2)}%, um pouco acima do que consideramos saudável.`,
    body: () => [
      "Isso costuma acontecer quando a lista tem endereços antigos, digitados com erro ou que já não existem mais. Nada está pausado — este é só um aviso cedo, enquanto é fácil resolver.",
      "O caminho mais rápido é limpar os endereços que já retornaram e ativar a confirmação de cadastro (double opt-in) nos formulários novos.",
    ],
    cta: "Ver detalhes da entregabilidade",
    tone: "neutral",
  },
  critical: {
    title: "Atenção: sua taxa de retorno está perto do limite",
    lead: (p) =>
      `A taxa de retorno do workspace ${p.teamName} chegou a ${p.bounceRate.toFixed(2)}%. O limite para pausa automática de envios é ${p.blockRate}%.`,
    body: (p) => [
      `Faltam ${Math.max(0, p.blockRate - p.bounceRate).toFixed(2)} ponto(s) percentual(is) para o limite. Ainda dá tempo de reverter, e queremos ajudar nisso.`,
      "Na página de entregabilidade você vê exatamente quais domínios e quais motivos estão puxando a taxa para cima, com o passo a passo de correção.",
    ],
    cta: "Ver o que está causando os retornos",
    tone: "attention",
  },
  blocked: {
    title: "Seus envios foram pausados — veja como retomar",
    lead: (p) =>
      `A taxa de retorno do workspace ${p.teamName} chegou a ${p.bounceRate.toFixed(2)}%, acima do limite de ${p.blockRate}%. Para proteger a entregabilidade da sua conta, pausamos os novos envios.`,
    body: () => [
      "Seu painel, seus contatos, seus relatórios e suas campanhas continuam exatamente onde estavam. Campanhas em andamento foram pausadas e retomam do ponto certo quando o envio voltar — nada foi perdido.",
      "Para voltar a enviar: limpe os endereços que retornaram, revise de onde vieram os contatos mais recentes e fale com a gente. A liberação volta sozinha assim que a taxa cair e houver envios novos saudáveis, e nosso time pode acompanhar esse processo com você.",
    ],
    cta: "Ver o plano de recuperação",
    tone: "stop",
  },
  blocked_reminder: {
    title: "Ainda podemos te ajudar a voltar a enviar",
    lead: (p) =>
      `Os envios do workspace ${p.teamName} seguem pausados, com taxa de retorno em ${p.bounceRate.toFixed(2)}%.`,
    body: () => [
      "Se ficou alguma dúvida sobre o que precisa ser ajustado, responda este e-mail: alguém do time olha a sua conta com você e indica o caminho mais curto.",
      "Seus dados continuam todos disponíveis no painel.",
    ],
    cta: "Falar com o suporte",
    tone: "attention",
  },
  supervised: {
    title: "Seus envios foram liberados em modo assistido",
    lead: (p) =>
      `Boa notícia: o time ${p.teamName} pode voltar a enviar, com acompanhamento.`,
    body: (p) => [
      `Durante esse período o limite diário fica em ${(p.supervisedLimit ?? 500).toLocaleString("pt-BR")} e-mails${p.supervisedUntil ? `, até ${p.supervisedUntil}` : ""}. É espaço suficiente para provar que a lista está saudável, sem arriscar a reputação da sua conta.`,
      `Se a taxa voltar a passar de ${p.blockRate}% nesse período, os envios são pausados de novo — e a gente te avisa na hora.`,
    ],
    cta: "Acompanhar minha entregabilidade",
    tone: "good",
  },
  recovered: {
    title: "Sua taxa de retorno voltou ao normal",
    lead: (p) =>
      `A taxa de retorno do workspace ${p.teamName} está em ${p.bounceRate.toFixed(2)}%, de volta à faixa saudável.`,
    body: () => [
      "Os envios seguem liberados normalmente. Obrigado pelo cuidado com a lista — isso protege a entrega dos seus e-mails e a de todo mundo que usa a plataforma.",
    ],
    cta: "Ver minha entregabilidade",
    tone: "good",
  },
};

const TONE_STYLE = {
  neutral: { bg: "#f9fafb", border: "#e5e7eb", color: "#374151" },
  attention: { bg: "#fff7ed", border: "#fed7aa", color: "#9a3412" },
  stop: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
  good: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
} as const;

export function ReputationEmail(props: ReputationEmailProps) {
  const copy = COPY[props.kind];
  const tone = TONE_STYLE[copy.tone];
  const paragraph = {
    fontSize: "16px",
    color: "#374151",
    margin: "0 0 16px 0",
    lineHeight: "1.6",
    textAlign: "left" as const,
  };

  return (
    <EmailLayout preview={copy.title}>
      <EmailHeader logoUrl={props.logoUrl} title={copy.title} />

      <Container style={{ padding: "20px 0", textAlign: "left" as const }}>
        <Text style={paragraph}>Olá, time {props.teamName},</Text>

        <Text style={paragraph}>{copy.lead(props)}</Text>

        <Container
          style={{
            backgroundColor: tone.bg,
            border: `1px solid ${tone.border}`,
            padding: "12px 16px",
            margin: "0 0 24px 0",
            borderRadius: "4px",
          }}
        >
          <Text
            style={{
              margin: 0,
              color: tone.color,
              fontSize: 14,
              textAlign: "left" as const,
            }}
          >
            Taxa de retorno: {props.bounceRate.toFixed(2)}% · limite:{" "}
            {props.blockRate}% · base de cálculo:{" "}
            {props.sampleSize.toLocaleString("pt-BR")} entregas dos últimos 30
            dias.
          </Text>
        </Container>

        {copy.body(props).map((text, index) => (
          <Text key={index} style={paragraph}>
            {text}
          </Text>
        ))}

        <Container style={{ margin: "8px 0 32px 0", textAlign: "left" as const }}>
          <EmailButton
            href={props.kind === "blocked_reminder" ? props.supportUrl : props.reputationUrl}
          >
            {copy.cta}
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
          Seu acesso ao painel, aos contatos e aos relatórios continua liberado.
          Qualquer dúvida, é só responder este e-mail.
        </Text>
      </Container>

      <EmailFooter />
    </EmailLayout>
  );
}

export async function renderReputationEmail(
  props: ReputationEmailProps,
): Promise<string> {
  return render(<ReputationEmail {...props} />);
}
