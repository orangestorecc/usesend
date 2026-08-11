import { useEffect, useState } from "react";

import { useEditorChrome } from "../context/EditorChromeContext";

/**
 * Visão somente leitura do HTML.
 *
 * Pede ao servidor (`/api/to-html`) o HTML REAL do e-mail — o mesmo que sai no
 * envio, com tabelas e CSS inline. Se a rota não responder (pacote embarcado
 * fora do app, servidor fora do ar), cai no `getHTML()` do editor, que mostra
 * só a estrutura do conteúdo.
 */
export function CodeView() {
  const { editor } = useEditorChrome();
  const estrutura = editor?.getHTML() ?? "";
  const [html, setHtml] = useState(estrutura);
  const [real, setReal] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!editor) return;
    let ativo = true;
    setCarregando(true);

    fetch("/api/to-html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editor.getJSON()),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { data?: string }) => {
        if (!ativo) return;
        if (json.data && !json.data.startsWith("Error")) {
          setHtml(json.data);
          setReal(true);
        }
      })
      .catch(() => {
        if (ativo) setReal(false);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
    // Só ao entrar no modo código: reagir a cada tecla dispararia um POST por
    // caractere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {carregando
            ? "Gerando HTML…"
            : real
              ? "HTML do e-mail"
              : "Estrutura do conteúdo (somente leitura)"}
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
        {real
          ? "Este é o HTML enviado, com tabelas e CSS embutido para compatibilidade com os clientes de e-mail."
          : "O HTML final do e-mail é gerado no envio, com tabelas e CSS embutido para compatibilidade com os clientes de e-mail."}
      </p>
    </div>
  );
}
