import { SiteFooter } from "~/components/SiteFooter";
import { TopNav } from "~/components/TopNav";
import { Button } from "@usesend/ui/src/button";
import { PricingCalculator } from "~/components/PricingCalculator";

// Links de produto — confirmar domínios finais com o time.
const APP_URL = "https://app.madmail.com.br";
const SIGNUP_URL = `${APP_URL}/cadastro`;
const LOGIN_URL = `${APP_URL}/login`;

export default function Page() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <TopNav />
      <Hero />
      <Clientes />
      <BlocoIA />
      <Editor />
      <AlemDaEdicao />
      <Entregabilidade />
      <Controle />
      <Pricing />
      <CtaFinal />
      <SiteFooter />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 pb-8 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            E-mail marketing na era da IA
          </div>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Dispare conversando
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Montar uma campanha era trabalho de agência. Agora você faz do seu
            ChatGPT ou Claude. Monte listas, segmente, agende disparos e leia a
            performance{" "}
            <span className="text-foreground">falando com o Madmail</span> —
            dentro do assistente que sua equipe já usa.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="px-6">
              <a href={SIGNUP_URL}>Criar sua conta</a>
            </Button>
            <Button size="lg" variant="outline" className="px-6">
              <a href="/ai">Ver como funciona</a>
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Feito para o varejo · Sem cartão para começar · Você paga só o que
            envia
          </p>
        </div>

        {/* Gesto da marca: a conversa que vira campanha */}
        <div className="mx-auto mt-16 max-w-3xl">
          <ChatMock />
        </div>
      </div>
    </section>
  );
}

function ChatMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#0A0A0A]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="ml-2 font-mono text-xs text-neutral-500">
          madmail · assistente
        </span>
      </div>
      <div className="space-y-4 p-5 font-mono text-sm leading-relaxed">
        <p className="text-neutral-400">
          <span className="mr-2 text-neutral-100">&gt;</span>
          segmente quem comprou nos últimos 90 dias e não abriu a última
          campanha
        </p>
        <p className="text-neutral-100">
          <span className="mr-2 text-neutral-500">&lt;</span>
          Encontrei <span className="text-white">4.812 contatos</span>. Escrevi
          um assunto e um corpo com 15% de desconto. Agendo para quinta, 10h?
        </p>
        <p className="text-neutral-400">
          <span className="mr-2 text-neutral-100">&gt;</span>
          manda ver
        </p>
        <p className="text-neutral-100">
          <span className="mr-2 text-neutral-500">&lt;</span>
          Feito. Disparo agendado.{" "}
          <span className="text-neutral-400">
            Aviso aqui quando abrir a leitura.
          </span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clientes (N49)                                                      */
/* ------------------------------------------------------------------ */

// 12 clientes da N49 — logos brancos (processados) para a banda escura.
const CLIENTES: { nome: string; slug: string }[] = [
  { nome: "Itabike", slug: "itabike" },
  { nome: "Casa Perini", slug: "casa-perini" },
  { nome: "IBASA", slug: "ibasa" },
  { nome: "Distribuidora Nacional", slug: "distribuidora-nacional" },
  { nome: "Maria Gueixa", slug: "maria-gueixa" },
  { nome: "Future", slug: "future" },
  { nome: "Tudobike", slug: "tudobike" },
  { nome: "Spazzio Jeans", slug: "spazzio-jeans" },
  { nome: "Pavan", slug: "pavan" },
  { nome: "Prado Hospitalar", slug: "prado-hospitalar" },
  { nome: "Vízia Óptica", slug: "vizia-optica" },
  { nome: "Bicisport", slug: "bicisport" },
];

function Clientes() {
  return (
    <section className="bg-black py-16">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mx-auto max-w-md text-center text-sm text-neutral-400">
          Varejistas de todos os tamanhos já disparam com a N49
        </p>
        <div className="mt-12 grid grid-cols-3 items-center gap-x-6 gap-y-12 sm:grid-cols-4 lg:grid-cols-6">
          {CLIENTES.map((c) => (
            <div
              key={c.slug}
              className="flex h-8 items-center justify-center"
              title={c.nome}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/clientes/white/${c.slug}.png`}
                alt={c.nome}
                className="max-h-7 w-auto max-w-[130px] object-contain opacity-70 transition hover:opacity-100"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bloco IA — o diferencial                                            */
/* ------------------------------------------------------------------ */

function BlocoIA() {
  const passos = [
    {
      prompt: "monta a lista de quem abandonou o carrinho ontem",
      resposta: "1.240 contatos prontos. Quer um cupom de 10%?",
    },
    {
      prompt: "agenda para as 19h e me avisa o resultado",
      resposta: "Agendado. Leitura e cliques chegam aqui em tempo real.",
    },
  ];

  return (
    <section id="ai" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">
              O jeito Madmail
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Sua mão de obra de e-mail agora é uma conversa
            </h2>
            <p className="mt-4 text-muted-foreground">
              Aquele trabalho de montar campanha — segmentar planilha, escrever,
              testar, agendar — agora você faz falando. O Madmail conecta ao
              ChatGPT, ao Claude ou a qualquer assistente via{" "}
              <span className="text-foreground">MCP</span> e executa de verdade:
              cria a lista, escreve, dispara e devolve a performance.
            </p>

            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Sem painel novo para aprender — fale como você já fala",
                "Segmentação e cópia sugeridas pela IA, aprovadas por você",
                "Disparo real via infraestrutura própria, não um brinquedo",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Check /> <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex gap-3">
              <Button>
                <a href={SIGNUP_URL}>Começar agora</a>
              </Button>
              <Button variant="outline">
                <a href="/ai#mcp">Conectar meu assistente</a>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {passos.map((p) => (
              <div
                key={p.prompt}
                className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 font-mono text-sm"
              >
                <p className="text-neutral-400">
                  <span className="mr-2 text-neutral-100">&gt;</span>
                  {p.prompt}
                </p>
                <p className="mt-3 text-neutral-100">
                  <span className="mr-2 text-neutral-500">&lt;</span>
                  {p.resposta}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Editor delicioso  (mantido do Resend, reinterpretado)               */
/* ------------------------------------------------------------------ */

function Editor() {
  return (
    <SplitFeature
      eyebrow="Editor"
      title="Escreva num editor que dá prazer de usar"
      body="Quando quiser a mão no teclado, o editor visual do Madmail responde na velocidade do pensamento. Blocos, marca e variáveis — sem código, com preview fiel a qualquer caixa de entrada."
      visual={<EditorMock />}
    />
  );
}

function EditorMock() {
  const tools = ["B", "I", "U", "H1", "H2", "•", "🔗", "{ }"];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        {tools.map((t, i) => (
          <span
            key={i}
            className="flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 font-mono text-xs text-muted-foreground hover:bg-accent"
          >
            {t}
          </span>
        ))}
        <span className="ml-auto rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          Preview
        </span>
      </div>
      <div className="space-y-4 p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Assunto
        </div>
        <div className="text-lg font-medium">
          Chegou a coleção que combina com você,{" "}
          <span className="rounded bg-primary/10 px-1 font-mono text-sm text-foreground">
            {"{{primeiro_nome}}"}
          </span>
        </div>
        <div className="h-px bg-border" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Separamos peças novas com base no seu último pedido. Frete grátis
          acima de{" "}
          <span className="rounded bg-primary/10 px-1 font-mono text-xs text-foreground">
            {"{{cupom}}"}
          </span>{" "}
          até domingo.
        </p>
        <div className="flex gap-2 pt-1">
          <span className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background">
            Ver novidades
          </span>
          <span className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
            Ver ofertas
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vá além da edição                                                   */
/* ------------------------------------------------------------------ */

function AlemDaEdicao() {
  const cards = [
    {
      title: "Templates com a sua marca",
      body: "Salve estilos e blocos uma vez. Reuse em cada campanha sem recomeçar do zero.",
    },
    {
      title: "Variáveis e personalização",
      body: "Nome, cupom, último pedido. Cada contato recebe a mensagem certa, no plural certo.",
    },
    {
      title: "Agendamento inteligente",
      body: "Dispare na melhor hora ou marque a data. A IA sugere, você confirma.",
    },
  ];
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">
          Vá além da edição
        </div>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
          Do rascunho ao disparo, sem trocar de ferramenta
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-border p-6"
            >
              <h3 className="font-medium">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Entregabilidade  (Reach humans, not spam folders)                   */
/* ------------------------------------------------------------------ */

function Entregabilidade() {
  return (
    <SplitFeature
      reverse
      eyebrow="Entregabilidade"
      title="Chegue em gente, não na pasta de spam"
      body="SPF, DKIM e DMARC configurados do jeito certo, IPs cuidados e supressão automática de quedas e reclamações. Entregabilidade é assunto sério — a gente trata como tal."
      visual={<DeliverabilityMock />}
    />
  );
}

function DeliverabilityMock() {
  const rows = [
    { email: "ana.souza@gmail.com", assunto: "Coleção nova", status: "Aberto" },
    { email: "joao@empresa.com.br", assunto: "Frete grátis fim de semana", status: "Clicado" },
    { email: "maria.lima@outlook.com", assunto: "Seu cupom expira hoje", status: "Entregue" },
    { email: "pedro@loja.com", assunto: "Voltamos ao estoque", status: "Aberto" },
    { email: "contato@antigo.test", assunto: "Novidades da semana", status: "Quedou" },
  ];
  const badge: Record<string, string> = {
    Entregue: "border-border text-muted-foreground",
    Aberto: "border-primary/40 text-foreground",
    Clicado: "border-primary/40 text-foreground",
    Quedou: "border-border text-muted-foreground line-through",
  };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
          Buscar por e-mail ou assunto
        </div>
        <span className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground">
          Todos os domínios
        </span>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2 font-normal">Para</th>
            <th className="px-4 py-2 font-normal">Assunto</th>
            <th className="px-4 py-2 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.email} className="border-t border-border">
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {r.email}
              </td>
              <td className="px-4 py-2.5 text-foreground">{r.assunto}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${badge[r.status]}`}
                >
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>98,7% entregues nas últimas 24h</span>
        <span className="font-mono">SPF · DKIM · DMARC ✓</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tudo sob seu controle  (Everything in your control)                 */
/* ------------------------------------------------------------------ */

function Controle() {
  const cards = [
    {
      title: "Métricas em tempo real",
      body: "Entregas, aberturas, cliques, quedas e descadastros num log simples e pesquisável.",
    },
    {
      title: "Contatos e consentimento",
      body: "Listas, status por lista e opt-in num lugar só. Atualiza sozinho a partir de quedas.",
    },
    {
      title: "Aberto e sem trava",
      body: "Código aberto e SMTP padrão. Sem lock-in de fornecedor, com dashboard de gente grande.",
    },
  ];
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">
          Tudo sob seu controle
        </div>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
          Transparência do primeiro envio ao relatório
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="rounded-xl border border-border p-6">
              <h3 className="font-medium">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pricing (espelha o Resend, em R$)                                   */
/* ------------------------------------------------------------------ */

function Pricing() {
  const planos = [
    {
      nome: "Free",
      preco: "R$ 0",
      nota: "para sempre",
      destaque: false,
      perks: [
        "3.000 e-mails por mês",
        "100 e-mails por dia",
        "1 domínio",
        "1 lista de contatos",
        "Retenção de dados de 1 dia",
      ],
      cta: "Começar grátis",
    },
    {
      nome: "Pro",
      preco: "R$ 100",
      nota: "por mês",
      destaque: true,
      perks: [
        "50.000 e-mails por mês",
        "Domínios ilimitados",
        "Retenção de dados de 3 dias",
        "Editor + automações",
        "Conector de IA (MCP)",
      ],
      cta: "Assinar o Pro",
    },
    {
      nome: "Scale",
      preco: "R$ 450",
      nota: "por mês",
      destaque: false,
      perks: [
        "100.000 e-mails por mês",
        "Retenção de dados de 7 dias",
        "IPs dedicados sob demanda",
        "Suporte prioritário",
        "Membros ilimitados",
      ],
      cta: "Assinar o Scale",
    },
  ];

  return (
    <section id="pricing" className="border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="text-sm uppercase tracking-wider text-muted-foreground">
            Preços
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Simples como o resto
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Comece de graça. Cresça quando o disparo crescer. Sem surpresa no
            fim do mês.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {planos.map((p) => (
            <div
              key={p.nome}
              className={`flex flex-col rounded-2xl border p-6 ${
                p.destaque
                  ? "border-primary/60 bg-primary/[0.04]"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{p.nome}</h3>
                {p.destaque ? (
                  <span className="rounded-full border border-primary/50 px-2 py-0.5 text-[11px] text-primary">
                    Mais popular
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight">
                  {p.preco}
                </span>
                <span className="mb-1 text-xs text-muted-foreground">
                  {p.nota}
                </span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check /> <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-2">
                <Button
                  className="w-full"
                  variant={p.destaque ? "default" : "outline"}
                >
                  <a href={SIGNUP_URL}>{p.cta}</a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <PricingCalculator />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Precisa de mais volume?{" "}
          <a href="mailto:contato@madmail.com.br" className="text-foreground underline underline-offset-4">
            Fale com a gente
          </a>{" "}
          sobre o plano Enterprise.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CTA final                                                           */
/* ------------------------------------------------------------------ */

function CtaFinal() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Dispare a Black Friday sem abrir o painel
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Crie sua conta em minutos e faça a primeira campanha conversando.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="px-6">
            <a href={SIGNUP_URL}>Criar sua conta</a>
          </Button>
          <a
            href={LOGIN_URL}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Já tenho conta →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Peças reutilizáveis                                                 */
/* ------------------------------------------------------------------ */

function SplitFeature({
  eyebrow,
  title,
  body,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className={reverse ? "lg:order-2" : ""}>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-4 text-muted-foreground">{body}</p>
          </div>
          <div className={reverse ? "lg:order-1" : ""}>{visual}</div>
        </div>
      </div>
    </section>
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
