"use client";

import { Editor } from "@usesend/email-editor";
import { Spinner } from "@usesend/ui/src/spinner";
import { Input } from "@usesend/ui/src/input";
import { toast } from "@usesend/ui/src/toaster";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
  DEFAULT_DOUBLE_OPT_IN_SUBJECT,
  DOUBLE_OPT_IN_EDITOR_VARIABLES,
  getDefaultDoubleOptInContent,
  hasDoubleOptInUrlPlaceholder,
} from "~/lib/constants/double-opt-in";
import { api } from "~/trpc/react";

const DOUBLE_OPT_IN_URL_REQUIRED_MESSAGE =
  "O conteúdo do e-mail de double opt-in deve incluir {{doubleOptInUrl}}.";

function parseEditorContent(content: string | null | undefined) {
  if (!content) {
    return getDefaultDoubleOptInContent();
  }

  try {
    return JSON.parse(content) as Record<string, any>;
  } catch {
    return getDefaultDoubleOptInContent();
  }
}

export default function DoubleOptInEditorPage({
  params,
}: {
  params: Promise<{ contactBookId: string }>;
}) {
  const { contactBookId } = use(params);

  const {
    data: contactBook,
    isLoading,
    error,
  } = api.contacts.getContactBookDetails.useQuery({
    contactBookId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-red">
          Falha ao carregar as configurações de double opt-in
        </p>
      </div>
    );
  }

  if (!contactBook) {
    return <div>Lista de contatos não encontrada</div>;
  }

  return <DoubleOptInEditor contactBook={contactBook} />;
}

function DoubleOptInEditor({
  contactBook,
}: {
  contactBook: {
    id: string;
    name: string;
    updatedAt: Date;
    doubleOptInFrom: string | null;
    doubleOptInSubject: string | null;
    doubleOptInContent: string | null;
  };
}) {
  const utils = api.useUtils();

  const [json, setJson] = useState<Record<string, any>>(
    parseEditorContent(contactBook.doubleOptInContent),
  );
  const [subject, setSubject] = useState(
    contactBook.doubleOptInSubject ?? DEFAULT_DOUBLE_OPT_IN_SUBJECT,
  );
  const [from, setFrom] = useState(contactBook.doubleOptInFrom ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const hasShownMissingPlaceholderToast = useRef(false);

  const updateContactBook = api.contacts.updateContactBook.useMutation({
    onSuccess: async () => {
      await utils.contacts.getContactBookDetails.invalidate({
        contactBookId: contactBook.id,
      });
      setIsSaving(false);
    },
  });

  function updateContent(contentValue: string) {
    updateContactBook.mutate(
      {
        contactBookId: contactBook.id,
        doubleOptInContent: contentValue,
      },
      {
        onError: (error) => {
          toast.error(error.message);
          setIsSaving(false);
        },
      },
    );
  }

  const debouncedUpdateContent = useDebouncedCallback(updateContent, 1000);

  return (
    <div className="p-4 container mx-auto">
      <div className="mx-auto">
        <div className="mb-4 flex justify-between items-center w-full sm:w-[700px] mx-auto">
          <div className="flex items-center gap-3">
            <Link href={`/contacts/${contactBook.id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="text-sm text-muted-foreground">
                E-mail de double opt-in
              </div>
              <div className="text-base font-medium">{contactBook.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
            {isSaving ? (
              <div className="h-2 w-2 bg-yellow rounded-full" />
            ) : (
              <div className="h-2 w-2 bg-green rounded-full" />
            )}
            {Date.now() - new Date(contactBook.updatedAt).getTime() < 60_000
              ? "agora mesmo"
              : `há ${formatDistanceToNow(contactBook.updatedAt)}`}
          </div>
        </div>

        <div className="flex flex-col mt-4 mb-4 p-4 w-full sm:w-[700px] mx-auto z-50 border rounded-lg shadow">
          <div className="flex items-center gap-4">
            <label className="block text-sm w-[80px] text-muted-foreground">
              Assunto
            </label>
            <Input
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
              }}
              onBlur={() => {
                const normalizedSubject =
                  subject.trim() || DEFAULT_DOUBLE_OPT_IN_SUBJECT;
                const currentSubject =
                  contactBook.doubleOptInSubject ??
                  DEFAULT_DOUBLE_OPT_IN_SUBJECT;

                if (normalizedSubject === currentSubject) {
                  return;
                }

                setIsSaving(true);
                updateContactBook.mutate(
                  {
                    contactBookId: contactBook.id,
                    doubleOptInSubject: normalizedSubject,
                  },
                  {
                    onError: (error) => {
                      toast.error(error.message);
                      setIsSaving(false);
                      setSubject(
                        contactBook.doubleOptInSubject ??
                          DEFAULT_DOUBLE_OPT_IN_SUBJECT,
                      );
                    },
                  },
                );
              }}
              className="mt-1 py-1 text-sm block w-full outline-none border-b border-transparent focus:border-border bg-transparent"
            />
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="block text-sm w-[80px] text-muted-foreground">
              De
            </label>
            <Input
              type="text"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
              }}
              onBlur={() => {
                const normalizedFrom = from.trim();
                const currentFrom = contactBook.doubleOptInFrom ?? "";

                if (normalizedFrom === currentFrom) {
                  return;
                }

                setIsSaving(true);
                updateContactBook.mutate(
                  {
                    contactBookId: contactBook.id,
                    doubleOptInFrom: normalizedFrom || null,
                  },
                  {
                    onError: (error) => {
                      toast.error(error.message);
                      setIsSaving(false);
                      setFrom(contactBook.doubleOptInFrom ?? "");
                    },
                  },
                );
              }}
              placeholder="Nome amigável <contato@seudominio.com.br>"
              className="mt-1 py-1 text-sm block w-full outline-none border-b border-transparent focus:border-border bg-transparent"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Use a variável <code>{"{{doubleOptInUrl}}"}</code> para o link de
            confirmação.
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 w-full sm:w-[700px] mx-auto p-4 sm:p-10">
          <div className="w-full sm:w-[600px] mx-auto">
            <Editor
              /* Esta tela ainda usa o container estreito de 600px: com o trilho
                 e o painel ligados o canvas colapsa. Opta por sair do shell até
                 a página ser reestruturada como as de campanhas e templates. */
              showBlockPalette={false}
              showPropertiesPanel={false}
              initialContent={json}
              onUpdate={(content) => {
                const nextContent = content.getJSON();
                const serializedContent = JSON.stringify(nextContent);

                setJson(nextContent);

                if (!hasDoubleOptInUrlPlaceholder(serializedContent)) {
                  debouncedUpdateContent.cancel();
                  setIsSaving(false);

                  if (!hasShownMissingPlaceholderToast.current) {
                    toast.error(DOUBLE_OPT_IN_URL_REQUIRED_MESSAGE);
                    hasShownMissingPlaceholderToast.current = true;
                  }

                  return;
                }

                hasShownMissingPlaceholderToast.current = false;
                setIsSaving(true);
                debouncedUpdateContent(serializedContent);
              }}
              variables={DOUBLE_OPT_IN_EDITOR_VARIABLES}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
