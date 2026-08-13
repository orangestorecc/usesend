"use client";

import { useState } from "react";

/**
 * Cabeçalho do e-mail no topo do canvas: De, Responder para, Assunto e
 * texto de prévia — no mesmo lugar onde aparecem na caixa de entrada.
 *
 * Cada campo é opcional: templates só têm assunto, campanhas têm todos.
 * Os valores são confirmados ao sair do campo (blur), acompanhando o
 * autosave com debounce que as páginas já usam.
 */
export type EmailHeaderField = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
};

export function EmailHeaderBar({
  from,
  replyTo,
  subject,
  previewText,
  rightSlot,
}: {
  from?: EmailHeaderField;
  replyTo?: EmailHeaderField;
  subject?: EmailHeaderField;
  previewText?: EmailHeaderField;
  /** Ações à direita do cabeçalho (ex.: usar/salvar template). */
  rightSlot?: React.ReactNode;
}) {
  // Campos secundários começam recolhidos, como no padrão dos clientes de
  // e-mail: só aparecem quando têm conteúdo ou quando são pedidos.
  const [showReplyTo, setShowReplyTo] = useState(Boolean(replyTo?.value));
  const [showPreview, setShowPreview] = useState(Boolean(previewText?.value));

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pt-6">
      {rightSlot ? (
        <div className="mb-2 flex justify-end gap-1.5">{rightSlot}</div>
      ) : null}
      {from ? (
        <HeaderRow
          label="De"
          field={from}
          placeholder={from.placeholder ?? "nome@seudominio.com"}
          action={
            replyTo && !showReplyTo ? (
              <button
                type="button"
                onClick={() => setShowReplyTo(true)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Responder para
              </button>
            ) : null
          }
        />
      ) : null}

      {replyTo && showReplyTo ? (
        <HeaderRow
          label="Responder para"
          field={replyTo}
          placeholder={replyTo.placeholder ?? "respostas@seudominio.com"}
        />
      ) : null}

      {subject ? (
        <HeaderRow
          label="Assunto"
          field={subject}
          placeholder={subject.placeholder ?? "Assunto do e-mail"}
          action={
            previewText && !showPreview ? (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Texto de prévia
              </button>
            ) : null
          }
        />
      ) : null}

      {previewText && showPreview ? (
        <HeaderRow
          label="Prévia"
          field={previewText}
          placeholder="Trecho exibido na caixa de entrada, depois do assunto"
        />
      ) : null}
    </div>
  );
}

function HeaderRow({
  label,
  field,
  placeholder,
  action,
}: {
  label: string;
  field: EmailHeaderField;
  placeholder?: string;
  action?: React.ReactNode;
}) {
  const [local, setLocal] = useState(field.value);

  // Mantém o campo em sincronia quando o valor muda por fora (ex: recarregar).
  if (local !== field.value && document.activeElement?.tagName !== "INPUT") {
    setLocal(field.value);
  }

  return (
    <div className="flex items-center gap-3 border-b py-2">
      <span className="w-[110px] shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <input
        value={local}
        placeholder={placeholder}
        readOnly={field.readOnly}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== field.value) field.onChange(local);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
      />
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
