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

/** Partidas rápidas do estado vazio: viram o prompt com um clique. */
const PARTIDAS = [
  "Anúncio de uma promoção de fim de semana",
  "Novidade do produto para a base de clientes",
  "Boas-vindas para quem acabou de assinar",
];

export function AiComposer({
  variant,
  targetPos,
  onDone,
}: {
  /**
   * `empty`  — card grande sob o canvas vazio; gera o e-mail inteiro.
   * `insert` — mesmo gerar, mas a partir do trilho, com conteúdo já escrito.
   * `block`  — vem do menu de contexto e reescreve o bloco em `targetPos`.
   */
  variant: "empty" | "insert" | "block";
  targetPos?: number;
  onDone?: () => void;
}) {
  const { editor, aiRequest } = useEditorChrome();
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
      if (variant !== "block") {
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

  // Estado vazio: a IA é o caminho principal, então o campo já vem aberto na
  // tela — nada de popover escondendo o recurso atrás de um clique.
  return (
    <div
      className={
        variant === "insert"
          ? "w-80"
          : "rounded-xl border bg-card p-4 shadow-sm"
      }
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
          <SparklesIcon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium leading-none">Escreva com IA</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {variant === "insert"
              ? "A IA escreve o trecho e insere onde o cursor está."
              : "Diga o que você quer comunicar e a IA monta o e-mail inteiro."}
          </p>
        </div>
      </div>

      <textarea
        autoFocus={variant === "insert"}
        rows={3}
        value={prompt}
        placeholder="Ex.: convite para a nossa liquidação de inverno, tom animado, com botão para a loja"
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void executar();
        }}
        className="mt-3 w-full resize-none rounded-lg border bg-background p-3 text-sm outline-none focus:border-foreground/30"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PARTIDAS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPrompt(p)}
            className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>

      {erro ? <p className="mt-2 text-xs text-destructive">{erro}</p> : null}

      <Button
        size="sm"
        className="mt-3 w-full"
        disabled={carregando || !prompt.trim()}
        onClick={() => void executar()}
      >
        {carregando
          ? "Gerando…"
          : variant === "insert"
            ? "Gerar e inserir"
            : "Gerar e-mail com IA"}
      </Button>
    </div>
  );
}

/**
 * Entrada permanente da IA no trilho esquerdo.
 *
 * O card do estado vazio some assim que o e-mail ganha o primeiro parágrafo —
 * sem este botão a IA viraria um recurso escondido no clique-direito, que é
 * justamente o contrário do que a tela quer comunicar.
 */
export function AiRailButton() {
  const { aiRequest } = useEditorChrome();
  const [aberto, setAberto] = useState(false);

  if (!aiRequest) return null;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Escrever com IA"
          aria-label="Escrever com IA"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background transition-opacity hover:opacity-85"
        >
          <SparklesIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-auto p-3">
        <AiComposer variant="insert" onDone={() => setAberto(false)} />
      </PopoverContent>
    </Popover>
  );
}
