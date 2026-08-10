import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "~/components/SiteFooter";
import { TopNav } from "~/components/TopNav";
import { Button } from "@usesend/ui/src/button";

// Links de produto — confirmar domínios finais com o time.
const APP_URL = "https://app.madmail.com.br";
const SIGNUP_URL = `${APP_URL}/cadastro`;
const DOCS_URL = "https://docs.madmail.com.br";
const SITE_URL = "https://www.madmail.com.br";

type Section = { title: string; body: string };

type Feature = {
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  sections: Section[];
};

const FEATURES: Record<string, Feature> = {
  "email-api": {
    eyebrow: "Email API",
    title: "Dispare transacionais com uma API simples",
    subtitle:
      "Confirmações, recuperação de senha, avisos de pedido. Uma API limpa para o e-mail que precisa chegar na hora.",
    bullets: [
      "Endpoints REST diretos, sem SDK obrigatório",
      "SPF, DKIM e DMARC já cuidados para você",
      "Webhooks de entrega, abertura, clique e queda",
    ],
    sections: [
      {
        title: "Integração em minutos",
        body: "Gere uma chave, faça a primeira chamada e comece a enviar. A documentação traz exemplos prontos em várias linguagens para você copiar e colar.",
      },
      {
        title: "Confiável no volume que importa",
        body: "A mesma infraestrutura que roda campanhas de varejo entrega seus transacionais. Retentativas, supressão automática e log pesquisável de cada envio.",
      },
    ],
  },
  smtp: {
    eyebrow: "SMTP",
    title: "Um relay SMTP que pluga em qualquer app",
    subtitle:
      "Já tem um sistema que envia e-mail? Aponte o SMTP para o Madmail e ganhe entregabilidade e métricas sem trocar de código.",
    bullets: [
      "Credenciais SMTP padrão, compatível com qualquer stack",
      "Sem reescrever nada: só mudar host, usuário e senha",
      "Mesmas métricas e supressão da API",
    ],
    sections: [
      {
        title: "Compatível com o que você já usa",
        body: "WordPress, ERP, e-commerce, ferramentas legadas — se fala SMTP, fala com o Madmail. Configure host, porta e credenciais e pronto.",
      },
      {
        title: "Visibilidade que o SMTP puro não dá",
        body: "Cada mensagem que passa pelo relay entra no mesmo painel: entregas, aberturas, cliques e quedas, com supressão automática de endereços problemáticos.",
      },
    ],
  },
  editor: {
    eyebrow: "Editor",
    title: "Monte campanhas sem escrever código",
    subtitle:
      "Um editor visual que responde na velocidade do pensamento. Blocos, marca e variáveis, com preview fiel a qualquer caixa de entrada.",
    bullets: [
      "Blocos de arrastar e soltar, sem HTML na mão",
      "Preview fiel em desktop e mobile",
      "Variáveis de personalização por contato",
    ],
    sections: [
      {
        title: "Da ideia ao layout em minutos",
        body: "Escolha blocos, ajuste cores e tipografia com a sua marca e monte um e-mail bonito sem depender de designer ou desenvolvedor.",
      },
      {
        title: "Preview que reflete a realidade",
        body: "Veja como o e-mail chega antes de disparar. O que você monta é o que o seu contato recebe, na caixa dele.",
      },
    ],
  },
  templates: {
    eyebrow: "Templates",
    title: "Reuse a sua marca e os seus blocos",
    subtitle:
      "Salve estilos e estruturas uma vez e comece cada campanha de onde parou, sem recomeçar do zero.",
    bullets: [
      "Biblioteca de templates da sua marca",
      "Blocos reutilizáveis entre campanhas",
      "Consistência visual em todo disparo",
    ],
    sections: [
      {
        title: "Comece do meio, não do começo",
        body: "Cabeçalho, rodapé, botões e seções que você usa sempre ficam salvos. Uma nova campanha nasce já com a cara da sua loja.",
      },
      {
        title: "Marca consistente, sempre",
        body: "Padronize cores, logotipo e tom em todos os e-mails. A equipe inteira dispara com a mesma identidade, sem retrabalho.",
      },
    ],
  },
  automacoes: {
    eyebrow: "Automações",
    title: "Fluxos e disparos que rodam sozinhos",
    subtitle:
      "Boas-vindas, carrinho abandonado, pós-compra. Configure uma vez e deixe o Madmail acompanhar cada contato no tempo certo.",
    bullets: [
      "Gatilhos por evento e por comportamento",
      "Agendamento na melhor hora",
      "A IA sugere o fluxo, você aprova",
    ],
    sections: [
      {
        title: "O e-mail certo, na hora certa",
        body: "Dispare quando o contato entra na lista, abandona o carrinho ou completa uma compra. Cada momento vira uma oportunidade sem trabalho manual.",
      },
      {
        title: "Monte fluxos conversando",
        body: "Descreva a automação para o seu assistente de IA e o Madmail arma o fluxo. Você revisa, ajusta e ativa quando estiver satisfeito.",
      },
    ],
  },
  contatos: {
    eyebrow: "Contatos",
    title: "Listas, consentimento e segmentos num lugar só",
    subtitle:
      "Organize contatos por lista, cuide do opt-in e crie segmentos vivos que se atualizam sozinhos a partir do comportamento.",
    bullets: [
      "Status por lista e opt-in em ordem",
      "Supressão automática de quedas e reclamações",
      "Segmentação por compra, abertura e clique",
    ],
    sections: [
      {
        title: "Base limpa, entrega melhor",
        body: "Endereços que caem ou reclamam saem da rota automaticamente. Sua reputação de envio agradece e sua entregabilidade sobe.",
      },
      {
        title: "Segmentos que se atualizam",
        body: "Peça para a IA separar quem comprou nos últimos 30 dias ou não abriu a última campanha. O segmento se mantém vivo, pronto para o próximo disparo.",
      },
    ],
  },
  webhooks: {
    eyebrow: "Webhooks",
    title: "Eventos do seu e-mail em tempo real",
    subtitle:
      "Receba cada entrega, abertura, clique, queda e reclamação no seu sistema, no instante em que acontece.",
    bullets: [
      "Eventos de entrega, abertura, clique e queda",
      "Payload JSON simples de consumir",
      "Reentrega automática em caso de falha",
    ],
    sections: [
      {
        title: "Conecte ao seu fluxo",
        body: "Atualize seu CRM, dispare uma ação interna ou alimente um dashboard. Os webhooks do Madmail levam os eventos para onde você precisar.",
      },
      {
        title: "Confiável de ponta a ponta",
        body: "Se o seu endpoint falhar, o Madmail tenta de novo. Você não perde evento e mantém os dois lados sempre em sincronia.",
      },
    ],
  },
  entregabilidade: {
    eyebrow: "Entregabilidade",
    title: "Chegue em gente, não na pasta de spam",
    subtitle:
      "SPF, DKIM e DMARC do jeito certo, IPs cuidados e supressão automática. Entregabilidade é assunto sério e a gente trata como tal.",
    bullets: [
      "Autenticação SPF, DKIM e DMARC configurada",
      "IPs monitorados e IPs dedicados sob demanda",
      "Supressão automática de quedas e reclamações",
    ],
    sections: [
      {
        title: "Reputação que você não precisa administrar",
        body: "Cuidamos dos IPs e da autenticação de domínio para o seu e-mail ser reconhecido como legítimo pelos provedores. Menos spam, mais caixa de entrada.",
      },
      {
        title: "Listas saudáveis, sem esforço",
        body: "Endereços inválidos e reclamações são suprimidos na hora. Você mantém a base limpa e protege a entregabilidade de cada envio futuro.",
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(FEATURES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = FEATURES[slug];
  if (!feature) {
    return { title: "Recurso não encontrado — Madmail" };
  }
  return {
    title: `${feature.title} — Madmail`,
    description: feature.subtitle,
    alternates: { canonical: `${SITE_URL}/features/${slug}` },
  };
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = FEATURES[slug];
  if (!feature) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <TopNav />

      {/* Hero */}
      <section>
        <div className="mx-auto max-w-3xl px-6 pb-8 pt-16 text-center sm:pt-24">
          <div className="text-sm uppercase tracking-wider text-muted-foreground">
            {feature.eyebrow}
          </div>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {feature.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-muted-foreground sm:text-lg">
            {feature.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="px-6">
              <a href={SIGNUP_URL}>Criar sua conta</a>
            </Button>
            <Button size="lg" variant="outline" className="px-6">
              <a href={DOCS_URL}>Ver a documentação</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Bullets */}
      <section className="py-8">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-4 rounded-2xl border border-border p-6 sm:grid-cols-3">
            {feature.bullets.map((b) => (
              <div key={b} className="flex items-start gap-3 text-sm">
                <Check /> <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {feature.sections.map((s) => (
              <div key={s.title} className="rounded-xl border border-border p-6">
                <h2 className="font-medium">{s.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Pronto para disparar conversando?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Crie sua conta em minutos e leve o {feature.eyebrow.toLowerCase()}{" "}
            para a sua operação.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="px-6">
              <a href={SIGNUP_URL}>Criar sua conta</a>
            </Button>
            <Button size="lg" variant="outline" className="px-6">
              <a href="/pricing">Ver preços</a>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
