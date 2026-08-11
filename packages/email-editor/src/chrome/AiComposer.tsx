import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@usesend/ui/src/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@usesend/ui/src/popover";

import { useEditorChrome } from "../context/EditorChromeContext";

/**
 * Composição por IA.
 *
 * `variant="empty"` aparece sob o canvas vazio e GERA um rascunho inteiro.
 * `variant="block"` vem do menu de contexto e REESCREVE o bloco em `targetPos`.
 *
 * Sem `aiRequest` no contexto (app não injetou executor), nada é renderizado —
 * o pacote não conhece tRPC.
 */

const SUGESTOES = ["Encurtar", "Deixar mais formal", "Corrigir gramática"];

export function AiComposer({
  variant,
  targetPos,
  onDone,
}: {
  variant: "empty" | "block";
  targetPos?: number;
  onDone?: () => void;
}) {
  const { editor, aiRequest } = useEditorChrome();
  const [aberto, setAberto] = useState(variant === "block");
  const [prompt, setPrompt] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!editor || !aiRequest) return null;

  const executar = async () => {
    const texto = prompt.trim();
    if (!texto || carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      if (variant === "empty") {
        const { html } = await aiRequest({ kind: "generate", prompt: texto });
        if (html) editor.chain().focus().insertContent(html).run();
      } else {
        if (typeof targetPos !== "number") return;
        const node = editor.state.doc.nodeAt(targetPos);
        if (!node) return;
        const { text } = await aiRequest({
          kind: "rewrite",
          text: node.textContent,
          instruction: texto,
        });
        if (text) {
          editor
            .chain()
            .focus()
            .insertContentAt(
              { from: targetPos, to: targetPos + node.nodeSize },
              {
                type: node.type.name,
                attrs: node.attrs,
                content: [{ type: "text", text }],
              },
            )
            .run();
        }
      }
      setPrompt("");
      setAberto(false);
      onDone?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao chamar a IA.");
    } finally {
      setCarregando(false);
    }
  };

  const conteudo = (
    <div className="w-80 space-y-2">
      <textarea
        autoFocus
        rows={3}
        value={prompt}
        placeholder={
          variant === "empty"
            ? "Descreva o e-mail que você quer escrever…"
            : "O que mudar neste bloco?"
        }
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void executar();
        }}
        className="w-full rounded-md bg-muted p-2 text-sm outline-none"
      />

      {variant === "block" ? (
        <div className="flex flex-wrap gap-1">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {erro ? <p className="text-xs text-destructive">{erro}</p> : null}

      {variant === "block" ? (
        <p className="text-[11px] text-muted-foreground">
          A formatação do trecho pode ser perdida.
        </p>
      ) : null}

      <Button
        size="sm"
        className="w-full"
        disabled={carregando || !prompt.trim()}
        onClick={() => void executar()}
      >
        {carregando ? "Gerando…" : "Gerar"}
      </Button>
    </div>
  );

  if (variant === "block") {
    return <div className="p-2">{conteudo}</div>;
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          Escrever com IA
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-2">
        {conteudo}
      </PopoverContent>
    </Popover>
  );
}
