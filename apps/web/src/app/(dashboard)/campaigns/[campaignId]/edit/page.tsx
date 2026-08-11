"use client";

import { api } from "~/trpc/react";
import { Spinner } from "@usesend/ui/src/spinner";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Editor } from "@usesend/email-editor";
import type { TiptapEditor } from "@usesend/email-editor";
import { EmailHeaderBar } from "~/components/editor/EmailHeaderBar";
import { use, useMemo, useState } from "react";
import { Campaign } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@usesend/ui/src/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";
import { toast } from "@usesend/ui/src/toaster";
import { useDebouncedCallback } from "use-debounce";
import { formatDistanceToNow } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@usesend/ui/src/accordion";
import ScheduleCampaign from "../../schedule-campaign";
import { useRouter } from "next/navigation";
import { getCampaignEditorVariables } from "~/lib/constants/campaign";
import { useAiRequest } from "~/components/editor/EditorAiBridge";

const sendSchema = z.object({
  confirmation: z.string(),
});

const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;

export default function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);

  const {
    data: campaign,
    isLoading,
    error,
  } = api.campaign.getCampaign.useQuery(
    { campaignId },
    {
      enabled: !!campaignId,
    },
  );

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
        <p className="text-red-500">Falha ao carregar a campanha</p>
      </div>
    );
  }

  if (!campaign) {
    return <div>Campanha não encontrada</div>;
  }

  return <CampaignEditor campaign={campaign} />;
}

function CampaignEditor({
  campaign,
}: {
  campaign: Campaign & { imageUploadSupported: boolean };
}) {
  const router = useRouter();
  const isApiCampaign = campaign.isApi;
  const contactBooksQuery = api.contacts.getContactBooks.useQuery({});
  const utils = api.useUtils();

  const [json, setJson] = useState<Record<string, any> | undefined>(
    campaign.content ? JSON.parse(campaign.content) : undefined,
  );
  const [isSaving, setIsSaving] = useState(false);
  const aiRequest = useAiRequest();
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(
    null,
  );
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [from, setFrom] = useState(campaign.from);
  const [contactBookId, setContactBookId] = useState(campaign.contactBookId);
  const [replyTo, setReplyTo] = useState<string | undefined>(
    campaign.replyTo[0],
  );
  const [previewText, setPreviewText] = useState<string | null>(
    campaign.previewText,
  );

  const updateCampaignMutation = api.campaign.updateCampaign.useMutation({
    onSuccess: () => {
      utils.campaign.getCampaign.invalidate();
      setIsSaving(false);
    },
  });
  const getUploadUrl = api.campaign.generateImagePresignedUrl.useMutation();

  function updateEditorContent() {
    if (isApiCampaign) {
      return;
    }
    updateCampaignMutation.mutate({
      campaignId: campaign.id,
      content: JSON.stringify(json),
    });
  }

  const deboucedUpdateCampaign = useDebouncedCallback(
    updateEditorContent,
    1000,
  );

  /**
   * Salva um campo do cabeçalho. Se o servidor recusar, avisa e desfaz a
   * mudança local — senão a tela mostraria um valor que não foi gravado.
   */
  function saveCampaignField(
    data: Record<string, unknown>,
    revert: () => void,
  ) {
    if (isApiCampaign) return;
    updateCampaignMutation.mutate(
      { campaignId: campaign.id, ...data } as never,
      {
        onError: (e) => {
          toast.error(`${e.message}. Revertendo alterações.`);
          revert();
        },
      },
    );
  }

  const handleFileChange = async (file: File) => {
    if (file.size > IMAGE_SIZE_LIMIT) {
      throw new Error(
        `O arquivo deve ter menos de ${IMAGE_SIZE_LIMIT / 1024 / 1024}MB`,
      );
    }

    const { uploadUrl, imageUrl } = await getUploadUrl.mutateAsync({
      name: file.name,
      type: file.type,
      campaignId: campaign.id,
    });

    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
    });

    if (!response.ok) {
      throw new Error("Falha ao enviar o arquivo");
    }

    return imageUrl;
  };

  const contactBook = contactBooksQuery.data?.find(
    (book) => book.id === contactBookId,
  );
  const editorVariables = useMemo(
    () => getCampaignEditorVariables(contactBook?.variables),
    [contactBook],
  );
  const variableSuggestionsHelperText = contactBookId
    ? undefined
    : "Selecione a lista de contatos para as variáveis relacionadas";

  return (
    <div className="p-4 container mx-auto ">
      <div className="mx-auto">
        <div className="mb-4 flex justify-between items-center w-[700px] mx-auto">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className=" border-0 focus:ring-0 focus:outline-none px-0.5 w-[300px]"
            disabled={isApiCampaign}
            readOnly={isApiCampaign}
            onBlur={() => {
              if (isApiCampaign) {
                return;
              }
              if (name === campaign.name || !name) {
                return;
              }
              updateCampaignMutation.mutate(
                {
                  campaignId: campaign.id,
                  name,
                },
                {
                  onError: (e) => {
                    toast.error(`${e.message}. Revertendo alterações.`);
                    setName(campaign.name);
                  },
                },
              );
            }}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {isSaving ? (
                <div className="h-2 w-2 bg-yellow-500 rounded-full" />
              ) : (
                <div className="h-2 w-2 bg-emerald-500 rounded-full" />
              )}
              {Date.now() - new Date(campaign.updatedAt).getTime() < 60_000
                ? "agora mesmo"
                : `há ${formatDistanceToNow(campaign.updatedAt)}`}
            </div>

            <ScheduleCampaign
              campaign={campaign}
              onScheduled={() => {
                router.push(`/campaigns/${campaign.id}`);
              }}
            />
          </div>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <div className="flex flex-col border shadow rounded-lg mt-12 mb-12 p-4 w-[700px] mx-auto z-50">
              <div className="flex items-center gap-4">
                <label className="block text-sm  w-[80px] text-muted-foreground">
                  Assunto
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                  }}
                  onBlur={() => {
                    if (isApiCampaign) {
                      return;
                    }
                    if (subject === campaign.subject || !subject) {
                      return;
                    }
                    updateCampaignMutation.mutate(
                      {
                        campaignId: campaign.id,
                        subject,
                      },
                      {
                        onError: (e) => {
                          toast.error(`${e.message}. Revertendo alterações.`);
                          setSubject(campaign.subject);
                        },
                      },
                    );
                  }}
                  className="mt-1 py-1 text-sm block w-full outline-none border-b border-transparent  focus:border-border bg-transparent"
                  disabled={isApiCampaign}
                  readOnly={isApiCampaign}
                />
                <AccordionTrigger className="py-0"></AccordionTrigger>
              </div>

              <AccordionContent className=" flex flex-col gap-4">
                <div className=" flex items-center gap-4 mt-4">
                  <label className=" text-sm  w-[80px] text-muted-foreground">
                    De
                  </label>
                  <input
                    type="text"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                    }}
                    className="mt-1 py-1 w-full text-sm outline-none border-b border-transparent  focus:border-border bg-transparent"
                    placeholder="Nome amigável<hello@example.com>"
                    onBlur={() => {
                      if (isApiCampaign) {
                        return;
                      }
                      if (from === campaign.from || !from) {
                        return;
                      }
                      updateCampaignMutation.mutate(
                        {
                          campaignId: campaign.id,
                          from,
                        },
                        {
                          onError: (e) => {
                            toast.error(`${e.message}. Revertendo alterações.`);
                            setFrom(campaign.from);
                          },
                        },
                      );
                    }}
                    disabled={isApiCampaign}
                    readOnly={isApiCampaign}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="block text-sm  w-[80px] text-muted-foreground">
                    Responder para
                  </label>
                  <input
                    type="text"
                    value={replyTo}
                    onChange={(e) => {
                      setReplyTo(e.target.value);
                    }}
                    className="mt-1 py-1 text-sm block w-full outline-none border-b border-transparent bg-transparent focus:border-border"
                    placeholder="hello@example.com"
                    onBlur={() => {
                      if (isApiCampaign) {
                        return;
                      }
                      if (replyTo === campaign.replyTo[0]) {
                        return;
                      }
                      updateCampaignMutation.mutate(
                        {
                          campaignId: campaign.id,
                          replyTo: replyTo ? [replyTo] : [],
                        },
                        {
                          onError: (e) => {
                            toast.error(`${e.message}. Revertendo alterações.`);
                            setReplyTo(campaign.replyTo[0]);
                          },
                        },
                      );
                    }}
                    disabled={isApiCampaign}
                    readOnly={isApiCampaign}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="block text-sm  w-[80px] text-muted-foreground">
                    Prévia
                  </label>
                  <input
                    type="text"
                    value={previewText ?? undefined}
                    onChange={(e) => {
                      setPreviewText(e.target.value);
                    }}
                    onBlur={() => {
                      if (isApiCampaign) {
                        return;
                      }
                      if (
                        previewText === campaign.previewText ||
                        !previewText
                      ) {
                        return;
                      }
                      updateCampaignMutation.mutate(
                        {
                          campaignId: campaign.id,
                          previewText,
                        },
                        {
                          onError: (e) => {
                            toast.error(`${e.message}. Revertendo alterações.`);
                            setPreviewText(campaign.previewText ?? "");
                          },
                        },
                      );
                    }}
                    className="mt-1 py-1 text-sm block w-full outline-none border-b border-transparent bg-transparent  focus:border-border"
                    disabled={isApiCampaign}
                    readOnly={isApiCampaign}
                  />
                </div>
                <div className=" flex items-center gap-2">
                  <label className="block text-sm  w-[80px] text-muted-foreground">
                    Para
                  </label>
                  {contactBooksQuery.isLoading ? (
                    <Spinner className="w-6 h-6" />
                  ) : (
                    <Select
                      value={contactBookId ?? ""}
                      disabled={isApiCampaign}
                      onValueChange={(val) => {
                        if (isApiCampaign) {
                          return;
                        }
                        // Update the campaign's contactBookId
                        updateCampaignMutation.mutate(
                          {
                            campaignId: campaign.id,
                            contactBookId: val,
                          },
                          {
                            onError: () => {
                              setContactBookId(campaign.contactBookId);
                            },
                          },
                        );
                        setContactBookId(val);
                      }}
                    >
                      <SelectTrigger className="w-[300px]">
                        {contactBook
                          ? `${contactBook.emoji} ${contactBook.name}`
                          : "Selecione uma lista de contatos"}
                      </SelectTrigger>
                      <SelectContent>
                        {contactBooksQuery.data?.map((book) => (
                          <SelectItem key={book.id} value={book.id}>
                            {book.emoji} {book.name}{" "}
                            <span className="text-xs text-muted-foreground ml-4">
                              {" "}
                              {book._count.contacts} contatos
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </AccordionContent>
            </div>
          </AccordionItem>
        </Accordion>

        {isApiCampaign ? (
          <p className="text-sm text-center text-muted-foreground">
            E-mail criado a partir da API. O conteúdo da campanha só pode ser
            atualizado via API.
          </p>
        ) : (
          <div className="rounded-lg border bg-gray-50">
            <Editor
              key={`campaign-editor-${contactBookId ?? "none"}-${editorVariables.join(",")}`}
              showBlockPalette
              showPropertiesPanel
              header={
                <EmailHeaderBar
                  from={{
                    value: from,
                    onChange: (v) => {
                      setFrom(v);
                      saveCampaignField({ from: v }, () => setFrom(campaign.from));
                    },
                  }}
                  replyTo={{
                    value: replyTo ?? "",
                    onChange: (v) => {
                      setReplyTo(v);
                      saveCampaignField({ replyTo: v ? [v] : [] }, () =>
                        setReplyTo(campaign.replyTo[0]),
                      );
                    },
                  }}
                  subject={{
                    value: subject,
                    onChange: (v) => {
                      setSubject(v);
                      saveCampaignField({ subject: v }, () =>
                        setSubject(campaign.subject),
                      );
                    },
                  }}
                  previewText={{
                    value: previewText ?? "",
                    onChange: (v) => {
                      setPreviewText(v);
                      saveCampaignField({ previewText: v }, () =>
                        setPreviewText(campaign.previewText),
                      );
                    },
                  }}
                />
              }
              initialContent={json}
              onCreate={(ed) => setEditorInstance(ed)}
              onUpdate={(content) => {
                setJson(content.getJSON());
                setIsSaving(true);
                deboucedUpdateCampaign();
              }}
              variables={editorVariables}
              variableSuggestionsHelperText={variableSuggestionsHelperText}
              onAiRequest={aiRequest}
              placeholder="Pressione '/' para comandos, ou use a IA para escrever seu e-mail"
              uploadImage={
                campaign.imageUploadSupported ? handleFileChange : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
