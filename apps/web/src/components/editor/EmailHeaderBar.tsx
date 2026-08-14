"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

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
  /**
   * Avisa que há texto digitado ainda não gravado. Sem isso o indicador de
   * autosave da página diz "Salvo" enquanto o usuário digita — e a alteração
   * se perde se ele fechar a aba antes de sair do campo.
   */
  onDirty?: () => void;
};

export function EmailHeaderBar({
  from,
  replyTo,
  subject,
  previewText,
  rightSlot,
  toSlot,
}: {
  from?: EmailHeaderField;
  replyTo?: EmailHeaderField;
  subject?: EmailHeaderField;
  previewText?: EmailHeaderField;
  /** Ações à direita do cabeçalho (ex.: usar/salvar template). */
  rightSlot?: React.ReactNode;
  /** Controle de destinatários (lista de contatos), na linha "Para". */
  toSlot?: React.ReactNode;
}) {
  // Campos secundários começam recolhidos, como no padrão dos clientes de
  // e-mail: só aparecem quando têm conteúdo ou quando são pedidos.
  const [showReplyTo, setShowReplyTo] = useState(Boolean(replyTo?.value));
  const [showPreview, setShowPreview] = useState(Boolean(previewText?.value));

  return (
    // Mesmo padding horizontal do canvas (p-4 sm:p-8) para que o cabeçalho e o
    // corpo do e-mail fiquem alinhados na mesma coluna.
    //
    // Cores fixas de tema claro (e não os tokens do app): o cartão do editor é
    // `bg-gray-50`, claro nos dois temas. Herdando o `text-foreground` do tema
    // escuro, o que o lojista digitasse aqui saía branco no branco.
    <div className="light w-full px-4 pt-6 text-black sm:px-8">
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
                className="text-xs text-neutral-500 transition-colors hover:text-black"
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

      {toSlot ? (
        <div className="flex items-center gap-3 border-b border-neutral-200 py-2">
          <span className="w-[110px] shrink-0 text-sm text-neutral-500">
            Para
          </span>
          <div className="min-w-0 flex-1">{toSlot}</div>
        </div>
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
                className="text-xs text-neutral-500 transition-colors hover:text-black"
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

  // Grava enquanto digita, não só ao sair do campo: quem fechava a aba com o
  // cursor ainda no assunto perdia a alteração sem nenhum aviso.
  const gravar = useDebouncedCallback((v: string) => {
    if (v !== field.value) field.onChange(v);
  }, 800);

  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 py-2">
      <span className="w-[110px] shrink-0 text-sm text-neutral-500">
        {label}
      </span>
      <input
        value={local}
        placeholder={placeholder}
        readOnly={field.readOnly}
        onChange={(e) => {
          setLocal(e.target.value);
          field.onDirty?.();
          gravar(e.target.value);
        }}
        onBlur={() => {
          gravar.cancel();
          if (local !== field.value) field.onChange(local);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-neutral-400 disabled:opacity-60"
      />
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
