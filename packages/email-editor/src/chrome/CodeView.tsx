import { useEditorChrome } from "../context/EditorChromeContext";

/**
 * Visão somente leitura do HTML.
 *
 * Mostra o HTML do editor (getHTML), que NÃO é o mesmo do e-mail enviado —
 * o e-mail final é gerado pelo EmailRenderer no servidor, com tabelas e CSS
 * inline. Serve para conferir a estrutura, não para copiar e enviar.
 */
export function CodeView() {
  const { editor } = useEditorChrome();
  const html = editor?.getHTML() ?? "";

  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Estrutura do conteúdo (somente leitura)
        </span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(html)}
          className="rounded border bg-background px-2 py-1 text-xs hover:bg-muted"
        >
          Copiar
        </button>
      </div>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded bg-background p-3 text-[11px] leading-relaxed">
        {html}
      </pre>
      <p className="mt-2 text-[11px] text-muted-foreground">
        O HTML final do e-mail é gerado no envio, com tabelas e CSS embutido
        para compatibilidade com os clientes de e-mail.
      </p>
    </div>
  );
}
