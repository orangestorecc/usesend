import { createContext, useContext, type ReactNode } from "react";
import type { Editor as TipTapEditor } from "@tiptap/core";

export type EditorMode = "edit" | "code";

export type AiRequest =
  | { kind: "generate"; prompt: string }
  | { kind: "rewrite"; text: string; instruction: string };

export type AiResult = { html?: string; text?: string };

export type EditorChromeValue = {
  editor: TipTapEditor | null;
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  /** Executor de IA injetado pelo app. Ausente => a UI de IA não aparece. */
  aiRequest?: (req: AiRequest) => Promise<AiResult>;
  uploadImage?: (file: File) => Promise<string>;
};

const EditorChromeContext = createContext<EditorChromeValue | null>(null);

export function EditorChromeProvider({
  value,
  children,
}: {
  value: EditorChromeValue;
  children: ReactNode;
}) {
  return (
    <EditorChromeContext.Provider value={value}>
      {children}
    </EditorChromeContext.Provider>
  );
}

/**
 * Acessa o estado compartilhado entre trilho, paleta e painel de propriedades.
 * Evita repassar o editor por prop em cada nível da árvore.
 */
export function useEditorChrome(): EditorChromeValue {
  const ctx = useContext(EditorChromeContext);
  if (!ctx) {
    throw new Error(
      "useEditorChrome precisa estar dentro de <EditorChromeProvider>.",
    );
  }
  return ctx;
}
