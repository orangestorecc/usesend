"use client";

import { Button } from "@usesend/ui/src/button";
import { Progress } from "@usesend/ui/src/progress";
import { CheckCircle2, Circle, Loader2, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "@usesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { DnsInstructionsActions } from "~/components/DnsInstructionsActions";

type Passo =
  | "DOMAIN_CREATED"
  | "DOMAIN_VERIFIED"
  | "LIST_CREATED"
  | "CONTACTS_ADDED"
  | "CAMPAIGN_SENT";

const CONTEUDO: Record<
  Passo,
  {
    titulo: string;
    resumo: string;
    detalhe: string;
    acao: { label: string; href: string };
    parabens: string;
  }
> = {
  DOMAIN_CREATED: {
    titulo: "Escolha o endereço que vai enviar seus e-mails",
    resumo: "Recomendamos usar um subdomínio da sua marca.",
    detalhe:
      "Use algo como envios.sualoja.com.br em vez do domínio principal. Assim, o e-mail que você já usa no dia a dia continua funcionando normalmente, mesmo se algo der errado nos disparos.",
    acao: { label: "Cadastrar meu domínio", href: "/domains" },
    parabens: "Domínio cadastrado! Agora falta liberar o envio.",
  },
  DOMAIN_VERIFIED: {
    titulo: "Prove que o domínio é seu",
    resumo: "É a etapa que dá mais trabalho — e a gente ajuda em todas as saídas.",
    detalhe:
      "Você precisa adicionar alguns registros no painel onde o domínio foi comprado. Se você não mexe nisso, baixe as instruções e mande para quem cuida do seu site. A liberação é automática assim que os dados propagarem.",
    acao: { label: "Ver os registros", href: "/domains" },
    parabens: "Domínio validado! Você já pode enviar e-mails.",
  },
  LIST_CREATED: {
    titulo: "Crie sua primeira lista",
    resumo: "É onde seus contatos ficam organizados.",
    detalhe:
      "Comece com uma lista de teste, só com você e alguns colegas. Dá para criar quantas listas quiser depois — por exemplo, uma para clientes e outra para quem só se cadastrou.",
    acao: { label: "Criar uma lista", href: "/contacts" },
    parabens: "Lista criada! Hora de colocar gente nela.",
  },
  CONTACTS_ADDED: {
    titulo: "Adicione alguns contatos",
    resumo: "Pode ser você mesmo, para testar.",
    detalhe:
      "Adicione um a um ou importe uma planilha. Se o double opt-in estiver ligado, cada contato recebe um pedido de confirmação — e ele só sai depois que seu domínio estiver validado.",
    acao: { label: "Adicionar contatos", href: "/contacts" },
    parabens: "Contatos adicionados! Falta só o disparo.",
  },
  CAMPAIGN_SENT: {
    titulo: "Monte e dispare sua primeira campanha",
    resumo: "O momento da verdade.",
    detalhe:
      "Escolha a lista, escreva o e-mail no editor e agende. Sugestão: mande primeiro para a lista de teste e veja como chega na sua caixa de entrada antes de falar com os clientes.",
    acao: { label: "Criar campanha", href: "/campaigns" },
    parabens: "Pronto! Sua primeira campanha saiu.",
  },
};

export function OnboardingWizard() {
  const progressoQuery = api.onboarding.getProgress.useQuery(undefined, {
    // Só enquanto espera o DNS: nos demais passos a ação é do usuário e um
    // polling constante seria só carga inútil no banco.
    refetchInterval: (query) =>
      query.state.data?.nextStep === "DOMAIN_VERIFIED" ? 30_000 : false,
  });
  const dominiosQuery = api.domain.domains.useQuery();

  const esperandoDns = progressoQuery.data?.nextStep === "DOMAIN_VERIFIED";
  const primeiroDominioId = dominiosQuery.data?.[0]?.id;

  // Enquanto o DNS nao propaga, o usuario fica olhando a tela. Reconsultar o
  // domínio a cada 30s dispara o refresh da verificacao no servidor e o passo
  // vira sozinho — sem precisar recarregar a pagina.
  api.domain.getDomain.useQuery(
    { id: primeiroDominioId ?? 0 },
    {
      enabled: esperandoDns && primeiroDominioId !== undefined,
      refetchInterval: 30_000,
    },
  );

  const passosConcluidos = progressoQuery.data?.completedCount;
  const concluidosAnteriores = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (passosConcluidos === undefined) return;

    if (
      concluidosAnteriores.current !== undefined &&
      passosConcluidos > concluidosAnteriores.current
    ) {
      toast.success("Passo concluído!");
    }

    concluidosAnteriores.current = passosConcluidos;
  }, [passosConcluidos]);

  if (progressoQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando seu progresso...
      </div>
    );
  }

  const progresso = progressoQuery.data;

  if (!progresso) {
    return null;
  }

  const percentual = Math.round(
    (progresso.completedCount / progresso.totalCount) * 100,
  );

  if (progresso.isComplete) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border p-10 text-center">
        <PartyPopper className="h-10 w-10 text-green" />
        <h1 className="text-2xl font-semibold">Tudo pronto!</h1>
        <p className="max-w-md text-muted-foreground">
          Seu domínio está validado, sua lista está montada e sua primeira
          campanha já saiu. Daqui em diante é acompanhar os resultados.
        </p>
        <Button asChild>
          <Link href="/dashboard">Ir para o painel</Link>
        </Button>
      </div>
    );
  }

  const primeiroDominio = dominiosQuery.data?.[0];

  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Vamos configurar sua conta</h1>
        <p className="text-muted-foreground">
          São 5 passos, na ordem. Você pode sair e voltar quando quiser — seu
          progresso fica salvo.
        </p>
        <div className="flex items-center gap-3">
          <Progress value={percentual} className="h-2" />
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {progresso.completedCount} de {progresso.totalCount}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {progresso.steps.map(({ step, completed }, indice) => {
          const conteudo = CONTEUDO[step as Passo];
          const eOProximo = progresso.nextStep === step;

          return (
            <div
              key={step}
              className={`rounded-xl border p-5 transition-colors ${
                eOProximo ? "border-primary/40 bg-muted/30" : ""
              } ${completed ? "opacity-70" : ""}`}
            >
              <div className="flex items-start gap-3">
                {completed ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex w-full flex-col gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Passo {indice + 1}
                    </span>
                    <h2 className="font-medium">{conteudo.titulo}</h2>
                    <p className="text-sm text-muted-foreground">
                      {completed ? conteudo.parabens : conteudo.resumo}
                    </p>
                  </div>

                  {/* Só o passo atual abre o detalhe: os concluídos viram uma
                      linha de check e os futuros não competem por atenção. */}
                  {eOProximo ? (
                    <>
                      <p className="text-sm">{conteudo.detalhe}</p>

                      {step === "DOMAIN_VERIFIED" && primeiroDominio ? (
                        <DnsInstructionsActions
                          domainId={primeiroDominio.id}
                          className="rounded-lg border border-dashed p-3"
                        />
                      ) : null}

                      <div>
                        <Button asChild size="sm">
                          <Link href={conteudo.acao.href}>
                            {conteudo.acao.label}
                          </Link>
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

