"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import React, { useMemo, useRef, useState } from "react";
import { TextMenu } from "./menus/TextMenu";
import { cn } from "@usesend/ui/lib/utils";

import { extensions } from "./extensions";
import LinkMenu from "./menus/LinkMenu";
import { Content, Editor as TipTapEditor } from "@tiptap/core";
import { UploadFn } from "./extensions/ImageExtension";
import { EditorShell } from "./chrome/EditorShell";
import { LeftRail } from "./chrome/LeftRail";
import { BlockPalette } from "./chrome/BlockPalette";
import { CodeView } from "./chrome/CodeView";
import { AiComposer } from "./chrome/AiComposer";
import { BlockContextMenu } from "./menus/BlockContextMenu";
import { isDocEmpty } from "./lib/doc-empty";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import {
  EditorChromeProvider,
  type AiRequest,
  type AiResult,
  type EditorMode,
} from "./context/EditorChromeContext";

export type { AiRequest, AiResult, EditorMode };

export type EditorProps = {
  onUpdate?: (content: TipTapEditor) => void;
  onCreate?: (editor: TipTapEditor) => void;
  initialContent?: Content;
  variables?: Array<string>;
  uploadImage?: UploadFn;
  variableSuggestionsHelperText?: string;

  // ---- Novos (todos opcionais; com tudo desligado o editor renderiza
  //      exatamente como antes da reformulação) ----

  /** Liga o trilho lateral e a paleta de blocos. Ligado por padrão. */
  showBlockPalette?: boolean;
  /** Liga o painel direito de propriedades / estilo da página. Ligado por padrão. */
  showPropertiesPanel?: boolean;
  /** Conteúdo acima do canvas (cabeçalho De/Assunto). */
  header?: React.ReactNode;
  /** Topo do painel direito (avatar, menu, Publicar). */
  panelHeaderSlot?: React.ReactNode;
  /** Rodapé do painel direito (tema, CSS global). */
  panelFooterSlot?: React.ReactNode;
  /** Executor de IA injetado pelo app. Ausente => a UI de IA não aparece. */
  onAiRequest?: (req: AiRequest) => Promise<AiResult>;
  /** Texto do placeholder do corpo. */
  placeholder?: string;
  /** Ações extras sob o canvas vazio (ex.: escolher template, subir HTML). */
  emptyStateSlot?: React.ReactNode;
  /** Modo controlado do trilho. Ausente => o componente controla sozinho. */
  mode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
};

export const Editor: React.FC<EditorProps> = ({
  onUpdate,
  onCreate,
  initialContent,
  variables,
  uploadImage,
  variableSuggestionsHelperText,
  showBlockPalette = true,
  showPropertiesPanel = true,
  header,
  panelHeaderSlot,
  panelFooterSlot,
  onAiRequest,
  placeholder,
  emptyStateSlot,
  mode: controlledMode,
  onModeChange,
}) => {
  const menuContainerRef = useRef(null);
  const [internalMode, setInternalMode] = useState<EditorMode>("edit");

  const mode = controlledMode ?? internalMode;
  const setMode = (next: EditorMode) => {
    if (!controlledMode) setInternalMode(next);
    onModeChange?.(next);
  };

  const editor = useEditor({
    editorProps: {
      attributes: {
        class: cn("unsend-prose w-full"),
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          // prevent default event listeners from firing when slash command is active
          if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
            const slashCommand = document.querySelector("#slash-command");
            if (slashCommand) {
              return true;
            }
          }
        },
      },
    },
    extensions: extensions({
      variables,
      uploadImage,
      variableSuggestionsHelperText,
      placeholder,
    }),
    onCreate: ({ editor }) => {
      onCreate?.(editor);
    },
    onUpdate: ({ editor }) => {
      onUpdate?.(editor);
    },
    content: initialContent,
  });

  const chromeValue = useMemo(
    () => ({
      editor,
      mode,
      setMode,
      aiRequest: onAiRequest,
      uploadImage,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, mode, onAiRequest, uploadImage],
  );

  // `useEditor` re-renderiza a cada transação, então o JSON já vem atual.
  // `isDocEmpty` (e não `editor.isEmpty`) porque um bloco sem texto — spacer,
  // imagem — precisa contar como conteúdo e derrubar o estado vazio.
  const vazio = editor ? isDocEmpty(editor.getJSON()) : true;

  const canvas = (
    <div
      className="bg-white rounded-md text-black p-4 sm:p-8 unsend-editor light"
      ref={menuContainerRef}
    >
      <EditorContent editor={editor} className="min-h-[50vh]" />
      {editor ? <TextMenu editor={editor} /> : null}
      {editor ? <LinkMenu editor={editor} appendTo={menuContainerRef} /> : null}
    </div>
  );

  /** Ações de partida, só com o documento ainda vazio. */
  const acoesIniciais =
    editor && vazio && (onAiRequest || emptyStateSlot) ? (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <AiComposer variant="empty" />
        {emptyStateSlot}
      </div>
    ) : null;

  // Sem nenhuma das novas áreas ligadas, devolve o canvas puro — mesmo DOM de
  // antes, para não afetar as telas que ainda não migraram.
  if (!showBlockPalette && !showPropertiesPanel && !header) {
    return canvas;
  }

  return (
    <EditorChromeProvider value={chromeValue}>
      <EditorShell
        header={header}
        left={
          showBlockPalette ? (
            <div className="flex h-full items-start">
              <LeftRail />
              {mode === "edit" ? <BlockPalette /> : null}
            </div>
          ) : undefined
        }
        right={
          showPropertiesPanel ? (
            <div className="flex h-full flex-col">
              {panelHeaderSlot}
              <div className="flex-1 overflow-y-auto">
                <PropertiesPanel />
              </div>
              {panelFooterSlot}
            </div>
          ) : undefined
        }
      >
        {mode === "code" ? (
          <CodeView />
        ) : (
          <>
            {canvas}
            {acoesIniciais}
            <BlockContextMenu />
          </>
        )}
      </EditorShell>
    </EditorChromeProvider>
  );
};
