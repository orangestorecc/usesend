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

  /** Liga o trilho lateral e a paleta de blocos. */
  showBlockPalette?: boolean;
  /** Liga o painel direito de propriedades / estilo da página. */
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
  showBlockPalette = false,
  showPropertiesPanel = false,
  header,
  panelHeaderSlot,
  panelFooterSlot,
  onAiRequest,
  placeholder,
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

  // Sem nenhuma das novas áreas ligadas, devolve o canvas puro — mesmo DOM de
  // antes, para não afetar as telas que ainda não migraram.
  if (!showBlockPalette && !showPropertiesPanel && !header) {
    return canvas;
  }

  return (
    <EditorChromeProvider value={chromeValue}>
      <EditorShell
        header={header}
        left={showBlockPalette ? <div data-editor-left /> : undefined}
        right={
          showPropertiesPanel ? (
            <div data-editor-right>
              {panelHeaderSlot}
              {panelFooterSlot}
            </div>
          ) : undefined
        }
      >
        {canvas}
      </EditorShell>
    </EditorChromeProvider>
  );
};
