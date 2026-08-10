import type { ReactNode } from "react";

/**
 * Estrutura de 3 colunas do editor: trilho/paleta à esquerda, canvas no meio,
 * painel de propriedades à direita.
 *
 * Cada coluna lateral só ocupa espaço quando recebe conteúdo — com ambas
 * ausentes o shell vira um contêiner simples e o canvas renderiza exatamente
 * como antes da reformulação. É isso que garante que ligar as flags seja
 * opcional e não quebre as telas atuais.
 */
export function EditorShell({
  left,
  right,
  header,
  children,
}: {
  left?: ReactNode;
  right?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
}) {
  const hasLeft = Boolean(left);
  const hasRight = Boolean(right);

  if (!hasLeft && !hasRight && !header) {
    return <>{children}</>;
  }

  return (
    <div className="flex w-full items-stretch">
      {hasLeft ? (
        <div className="relative z-20 shrink-0">{left}</div>
      ) : null}

      <div className="min-w-0 flex-1">
        {header ? <div className="w-full">{header}</div> : null}
        {children}
      </div>

      {hasRight ? (
        <div className="w-[300px] shrink-0 border-l bg-background">{right}</div>
      ) : null}
    </div>
  );
}
