import { DomainStatus } from "@prisma/client";

import { db } from "~/server/db";
import { addOrUpdateContact } from "../contact-service";
import { createContactBook } from "../contact-book-service";
import { fetchCustomersPage, mapCustomer, type SubscribeMode } from "./orangestore";

export type TestImportResult = {
  contactBookId: string;
  contactBookName: string;
  doubleOptInEnabled: boolean;
  /** Cliente real lido da loja, só para conferir a leitura e o mapeamento. */
  amostra: {
    email?: string;
    firstName?: string;
    lastName?: string;
    newsletterNaLoja: boolean;
    propriedades: Record<string, string>;
  } | null;
  contato: {
    id: string;
    email: string;
    subscribed: boolean;
  } | null;
  email: {
    id: string;
    subject: string;
    to: string[];
    status: string;
  } | null;
  /** Explicação do porquê o e-mail saiu ou não. Sempre preenchida. */
  veredito: string;
};

/**
 * Simulação de importação: lê um cliente real da loja, cria uma lista de teste
 * e importa um único contato **pelo mesmo caminho de código da sincronização
 * de verdade** (`addOrUpdateContact`). É isso que dá valor ao teste — se ele
 * fosse uma implementação paralela, não provaria nada sobre o comportamento
 * real.
 *
 * O contato é criado com o e-mail de destino que o usuário informar, e não com
 * o e-mail do cliente da loja: assim dá para verificar o double opt-in sem
 * disparar mensagem para um cliente real de verdade.
 */
export async function runTestImport(opts: {
  teamId: number;
  baseUrl: string;
  apiKey: string;
  subscribeMode: SubscribeMode;
  doubleOptInEnabled: boolean;
  destinationEmail: string;
}): Promise<TestImportResult> {
  const clientes = await fetchCustomersPage({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    limit: 1,
    page: 1,
  });

  const bruto = clientes[0];
  const mapeado = bruto ? mapCustomer(bruto, opts.subscribeMode) : null;

  const carimbo = new Date().toISOString().slice(0, 16).replace("T", " ");
  const book = await createContactBook(
    opts.teamId,
    `[Teste] Integração — ${carimbo}`,
    undefined,
    undefined,
    { isTest: true, doubleOptInEnabled: opts.doubleOptInEnabled },
  );

  const base = {
    contactBookId: book.id,
    contactBookName: book.name,
    doubleOptInEnabled: opts.doubleOptInEnabled,
    amostra: mapeado
      ? {
          email: mapeado.email,
          firstName: mapeado.firstName,
          lastName: mapeado.lastName,
          newsletterNaLoja: mapeado.subscribed === true,
          propriedades: (mapeado.properties ?? {}) as Record<string, string>,
        }
      : null,
  };

  if (!mapeado) {
    return {
      ...base,
      contato: null,
      email: null,
      veredito: bruto
        ? "A loja respondeu, mas o primeiro cliente não tem e-mail válido — ele seria ignorado na importação."
        : "A loja respondeu sem nenhum cliente. Não há o que importar.",
    };
  }

  // O e-mail vai para o endereço de teste; o resto dos dados é do cliente real.
  const inicio = new Date();
  const contato = await addOrUpdateContact(
    book.id,
    { ...mapeado, email: opts.destinationEmail.toLowerCase() },
    opts.teamId,
  );

  const emailGerado = await db.email.findFirst({
    where: {
      teamId: opts.teamId,
      createdAt: { gte: inicio },
      to: { has: opts.destinationEmail.toLowerCase() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, subject: true, to: true, latestStatus: true },
  });

  return {
    ...base,
    contato: {
      id: contato.id,
      email: contato.email,
      subscribed: contato.subscribed,
    },
    email: emailGerado
      ? {
          id: emailGerado.id,
          subject: emailGerado.subject,
          to: emailGerado.to,
          status: emailGerado.latestStatus ?? "QUEUED",
        }
      : null,
    veredito: explicar({
      doubleOptInEnabled: opts.doubleOptInEnabled,
      newsletterNaLoja: mapeado.subscribed === true,
      subscribeMode: opts.subscribeMode,
      houveEmail: emailGerado !== null,
    }),
  };
}

function explicar(d: {
  doubleOptInEnabled: boolean;
  newsletterNaLoja: boolean;
  subscribeMode: SubscribeMode;
  houveEmail: boolean;
}): string {
  if (!d.doubleOptInEnabled) {
    return d.houveEmail
      ? "ATENÇÃO: o double opt-in está desligado e mesmo assim um e-mail foi gerado. Isso não deveria acontecer — não use esta integração e nos avise."
      : "Double opt-in desligado e nenhum e-mail foi gerado, como esperado. O contato entrou direto na lista.";
  }

  if (!d.newsletterNaLoja && d.subscribeMode === "newsletter") {
    return d.houveEmail
      ? "ATENÇÃO: o cliente não tinha newsletter marcada na loja, então ele entra como não inscrito e não deveria receber pedido de confirmação — mas um e-mail foi gerado."
      : "Double opt-in ligado, mas este cliente não tem newsletter marcada na loja. Com o modo 'Respeitar Newsletter da loja' ele entra como não inscrito e não recebe pedido de confirmação. Nenhum e-mail foi gerado, como esperado.";
  }

  return d.houveEmail
    ? "Double opt-in ligado e o e-mail de confirmação foi gerado, como esperado. Confira a entrega em Emails."
    : "Double opt-in ligado, mas nenhum e-mail foi gerado. A causa mais comum é não haver domínio verificado para enviar. Confira em Domínios.";
}

/** Existe algum domínio verificado para o time? Sem isso o double opt-in falha. */
export async function temDominioVerificado(teamId: number): Promise<boolean> {
  const dominio = await db.domain.findFirst({
    where: { teamId, status: DomainStatus.SUCCESS },
    select: { id: true },
  });
  return dominio !== null;
}
