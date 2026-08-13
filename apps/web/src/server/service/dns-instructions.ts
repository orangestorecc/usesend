import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { getDomains } from "./domain-service";

type Registro = {
  type: string;
  name: string;
  value: string;
  ttl?: string | null;
  priority?: string | null;
  recommended?: boolean;
  group?: string | null;
};

const TITULOS_POR_GRUPO: Record<string, string> = {
  verification: "Autenticação do domínio",
  sending: "Envio (SPF e retorno de mensagens)",
  receiving: "Recebimento de e-mails",
};

function tabela(registros: Registro[]) {
  const linhas = registros.map((r) => {
    const valor = r.value.replace(/\|/g, "\\|");
    const prioridade = r.priority ? ` (prioridade ${r.priority})` : "";
    return `| ${r.type} | \`${r.name}\` | \`${valor}\`${prioridade} | ${r.ttl ?? "Auto"} |`;
  });

  return [
    "| Tipo | Nome / Host | Valor | TTL |",
    "| --- | --- | --- | --- |",
    ...linhas,
  ].join("\n");
}

/**
 * Documento que o lojista repassa ao tecnico dele. Escrito na voz do lojista de
 * proposito: quem recebe nao e cliente da Madmail e nao conhece o produto.
 */
export async function buildDnsInstructionsMarkdown({
  domainId,
  teamId,
  teamName,
}: {
  domainId: number;
  teamId: number;
  teamName: string;
}) {
  const [domain] = await getDomains(teamId, { domainId });

  if (!domain) {
    throw new Error("Domínio não encontrado");
  }

  const registros = domain.dnsRecords as Registro[];
  const grupos = new Map<string, Registro[]>();

  for (const registro of registros) {
    const grupo = registro.group ?? "verification";
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), registro]);
  }

  const secoes = [...grupos.entries()].map(([grupo, itens], indice) => {
    const opcional = grupo === "receiving" ? " (opcional)" : "";
    return [
      `### ${indice + 1}. ${TITULOS_POR_GRUPO[grupo] ?? grupo}${opcional}`,
      "",
      tabela(itens),
    ].join("\n");
  });

  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return `# Configuração de DNS — ${domain.name}

Olá! Sou responsável pela **${teamName}** e preciso adicionar alguns registros
de DNS para conseguir enviar e-mails pela Madmail.

Se você cuida do domínio **${domain.name}**, pode seguir os passos abaixo.
Leva cerca de 10 minutos e **nada aqui afeta o site nem os e-mails atuais**.

## Registros a adicionar

${secoes.join("\n\n")}

## Observações importantes

- **Não remova** registros SPF, MX ou TXT que já existam no domínio. Estes são
  adicionais.
- Se o domínio já tiver um SPF, some as diretivas em um único registro em vez de
  criar um segundo — dois SPF no mesmo host invalidam os dois.
- Alguns painéis completam o domínio sozinhos no campo "Nome". Se o painel já
  mostra \`.${domain.name}\` no final, digite apenas a parte da esquerda.
- A propagação leva de 15 minutos a 24 horas.

## Como confirmar que deu certo

Nada precisa ser avisado manualmente: assim que os registros propagarem, o
painel da Madmail passa a exibir o domínio como **Validado** automaticamente.

## Em caso de dúvida

- Documentação: https://docs.madmail.com.br/guides/dominios
- Suporte: suporte@madmail.com.br

---
Gerado em ${geradoEm} pela Madmail.
`;
}
