"use client";

import { useState } from "react";
import type { TiptapEditor } from "@usesend/email-editor";
import { Button } from "@usesend/ui/src/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@usesend/ui/src/popover";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Textarea } from "@usesend/ui/src/textarea";
import { toast } from "@usesend/ui/src/toaster";
import { PaletteIcon, SparklesIcon } from "lucide-react";
import { api } from "~/trpc/react";

type PageStyle = {
  backgroundColor?: string;
  contentBackground?: string;
  contentWidth?: string;
  fontFamily?: string;
};

const FONTS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: '"Times New Roman", serif' },
  { label: "Courier", value: '"Courier New", monospace' },
];

/**
 * Barra acima do editor: estilo global da página + geração por IA.
 */
export function EditorToolbar({ editor }: { editor: TiptapEditor | null }) {
  const [prompt, setPrompt] = useState("");
  const generate = api.ai.generateEmail.useMutation();

  const pageStyle: PageStyle =
    (editor?.state.doc.attrs.pageStyle as PageStyle) ?? {};

  const setStyle = (patch: PageStyle) => {
    editor?.chain().focus().setPageStyle(patch).run();
  };

  const runGenerate = () => {
    if (!prompt.trim() || !editor) return;
    generate.mutate(
      { prompt },
      {
        onSuccess: ({ html }) => {
          editor.chain().focus().insertContent(html).run();
          toast.success("Conteúdo gerado e inserido.");
          setPrompt("");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="mb-3 flex items-center justify-end gap-2">
      {/* Estilo da página */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <PaletteIcon className="mr-1.5 h-4 w-4" /> Estilo da página
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Fundo da página</Label>
            <input
              type="color"
              value={pageStyle.backgroundColor ?? "#ffffff"}
              onChange={(e) => setStyle({ backgroundColor: e.target.value })}
              className="h-7 w-10 rounded border"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Fundo do conteúdo</Label>
            <input
              type="color"
              value={pageStyle.contentBackground ?? "#ffffff"}
              onChange={(e) => setStyle({ contentBackground: e.target.value })}
              className="h-7 w-10 rounded border"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Largura do conteúdo</Label>
            <div className="flex gap-1">
              {["560px", "600px", "680px"].map((w) => (
                <button
                  key={w}
                  onClick={() => setStyle({ contentWidth: w })}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${
                    (pageStyle.contentWidth ?? "600px") === w
                      ? "border-blue-400 bg-blue-50"
                      : ""
                  }`}
                >
                  {w.replace("px", "")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fonte</Label>
            <select
              value={pageStyle.fontFamily ?? FONTS[0]!.value}
              onChange={(e) => setStyle({ fontFamily: e.target.value })}
              className="w-full rounded border px-2 py-1 text-sm"
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </PopoverContent>
      </Popover>

      {/* Gerar com IA */}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm">
            <SparklesIcon className="mr-1.5 h-4 w-4" /> Gerar com IA
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-2">
          <Label className="text-xs">Descreva o e-mail que você quer</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: anúncio de Black Friday com 30% de desconto, tom empolgante, com um botão de CTA."
            rows={4}
          />
          <Button
            className="w-full"
            size="sm"
            onClick={runGenerate}
            disabled={generate.isPending}
          >
            {generate.isPending ? "Gerando…" : "Gerar e inserir"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            O conteúdo é inserido no final do e-mail. Você pode editar depois.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
