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
