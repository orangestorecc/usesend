/**
 * Selo de infraestrutura.
 *
 * O logotipo é desenhado em SVG em vez de baixado: a marca da AWS tem regras
 * de uso, e um arquivo solto na pasta public envelhece sem ninguém perceber.
 * A forma abaixo é a "smile" do logotipo, redesenhada, sem usar o arquivo
 * oficial — se um dia o jurídico pedir o asset licenciado, troca-se aqui.
 */

function LogoAws({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 48"
      className={className}
      role="img"
      aria-label="Amazon Web Services"
    >
      <text
        x="4"
        y="24"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="22"
        fontWeight="700"
        fill="currentColor"
      >
        aws
      </text>
      <path
        d="M6 34c14 8 40 10 62 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M62 31.5 68 35l-5.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Versão completa, para blocos de conteúdo. */
export function AwsSesBadge() {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:gap-5">
      <LogoAws className="h-10 w-16 shrink-0 text-foreground" />
      <div>
        <p className="text-sm font-medium">
          Entregue pela infraestrutura da AWS, via Amazon SES
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Seus e-mails saem pela mesma malha de envio que atende algumas das
          maiores operações do mundo. Você fica com o editor, os contatos, as
          automações, as métricas e a nota fiscal em real — sem precisar
          montar e cuidar dessa infraestrutura.
        </p>
      </div>
    </div>
  );
}

/** Versão em uma linha, para o rodapé dos planos. */
export function AwsSesLinha() {
  return (
    <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <LogoAws className="h-5 w-8 shrink-0" />
      <span>Entrega pela infraestrutura da AWS, via Amazon SES</span>
    </p>
  );
}

/**
 * Bloco longo sobre a infraestrutura de envio.
 *
 * Os pontos são qualitativos de propósito. Número de disparo por segundo ou
 * percentual de caixa de entrada varia por remetente e por provedor de
 * destino — publicar um valor fixo seria promessa que não se sustenta, e em
 * entregabilidade promessa quebrada custa a conta do cliente.
 */
export function InfraAwsSecao() {
  const pontos = [
    {
      titulo: "Escala que já nasceu pronta",
      corpo:
        "O Amazon SES é a mesma infraestrutura que a Amazon usa para o próprio volume. Não é um servidor de e-mail que cresce quando a gente lembra de crescer: a capacidade já está lá quando a sua campanha dispara.",
    },
    {
      titulo: "Relacionamento com os provedores",
      corpo:
        "Gmail, Outlook, Yahoo e os grandes provedores mantêm canais de retorno com a AWS. Reclamação de spam e endereço inexistente voltam como sinal estruturado, e não como silêncio — é isso que permite suprimir na hora, antes de virar dano de reputação.",
    },
    {
      titulo: "Reputação monitorada de verdade",
      corpo:
        "Taxa de retorno e de reclamação são acompanhadas continuamente. Quando algo sai da faixa saudável, aparece antes de o provedor começar a mandar seus e-mails para o spam.",
    },
    {
      titulo: "IP dedicado quando faz sentido",
      corpo:
        "Volume alto e constante justifica IP dedicado, com aquecimento gradual. Volume menor entrega melhor em IP compartilhado bem cuidado — e a gente diz qual é o seu caso em vez de vender o mais caro.",
    },
    {
      titulo: "Autenticação no padrão que os provedores cobram",
      corpo:
        "SPF, DKIM e DMARC configurados no seu domínio, do jeito que Gmail e Yahoo passaram a exigir de quem envia em volume. Sem isso, nenhuma infraestrutura salva a entrega.",
    },
    {
      titulo: "O que fica do nosso lado",
      corpo:
        "A AWS entrega o cano. A Madmail entrega o editor, os contatos, as automações, as métricas, o relay SMTP, o conector de IA e a nota fiscal em real — sem você precisar montar, configurar e cuidar dessa infraestrutura.",
    },
  ];

  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-4xl px-6">
        <div className="flex items-center gap-4">
          <LogoAws className="h-10 w-16 shrink-0 text-foreground" />
          <div>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">
              Infraestrutura
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Entregue pela AWS, via Amazon SES
            </h2>
          </div>
        </div>

        <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">
          Entregabilidade não se resolve com truque de assunto: depende de
          autenticação correta, reputação limpa e uma malha de envio que os
          provedores de destino já reconhecem. Por isso os seus e-mails saem
          pela infraestrutura da Amazon Web Services.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {pontos.map((p) => (
            <div key={p.titulo} className="rounded-xl border border-border p-5">
              <h3 className="font-medium">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {p.corpo}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Vale a franqueza: nenhuma infraestrutura garante caixa de entrada. O
          que ela garante é que o problema, quando existir, seja o seu conteúdo
          ou a sua lista — e não o cano por onde o e-mail passou.
        </p>
      </div>
    </section>
  );
}
