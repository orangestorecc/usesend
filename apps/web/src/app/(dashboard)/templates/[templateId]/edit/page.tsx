"use client";

import { api } from "~/trpc/react";
import { Spinner } from "@usesend/ui/src/spinner";
import { Input } from "@usesend/ui/src/input";
import { Editor } from "@usesend/email-editor";
import { EmailHeaderBar } from "~/components/editor/EmailHeaderBar";
import { useState } from "react";
import { Template } from "@prisma/client";
import { toast } from "@usesend/ui/src/toaster";
import { useDebouncedCallback } from "use-debounce";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);

  const {
    data: template,
    isLoading,
    error,
  } = api.template.getTemplate.useQuery(
    { templateId: templateId },
    {
      enabled: !!templateId,
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
        <p className="text-red-500">Falha ao carregar o template</p>
      </div>
    );
  }

  if (!template) {
    return <div>Template não encontrado</div>;
  }

  return <TemplateEditor template={template} />;
}

function TemplateEditor({
  template,
}: {
  template: Template & { imageUploadSupported: boolean };
}) {
  const utils = api.useUtils();

  const [json, setJson] = useState<Record<string, any> | undefined>(
    template.content ? JSON.parse(template.content) : undefined,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);

  const updateTemplateMutation = api.template.updateTemplate.useMutation({
    onSuccess: () => {
      utils.template.getTemplate.invalidate();
      setIsSaving(false);
    },
  });
  const getUploadUrl = api.template.generateImagePresignedUrl.useMutation();

  function updateEditorContent() {
    updateTemplateMutation.mutate({
      templateId: template.id,
      content: JSON.stringify(json),
    });
  }

  const deboucedUpdateTemplate = useDebouncedCallback(
    updateEditorContent,
    1000,
  );

  const handleFileChange = async (file: File) => {
    if (file.size > IMAGE_SIZE_LIMIT) {
      throw new Error(
        `O arquivo deve ter menos de ${IMAGE_SIZE_LIMIT / 1024 / 1024}MB`,
      );
    }

    console.log("file type: ", file.type);

    const { uploadUrl, imageUrl } = await getUploadUrl.mutateAsync({
      name: file.name,
      type: file.type,
      templateId: template.id,
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

  return (
    <div className="p-4 container mx-auto">
      <div className="mx-auto">
        <div className="mb-4 flex justify-between items-center w-full sm:w-[700px] mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className=" border-0 focus:ring-0 focus:outline-none px-0.5 w-full sm:w-[300px]"
              onBlur={() => {
                if (name === template.name || !name) {
                  return;
                }
                updateTemplateMutation.mutate(
                  {
                    templateId: template.id,
                    name,
                  },
                  {
                    onError: (e) => {
                      toast.error(`${e.message}. Revertendo alterações.`);
                      setName(template.name);
                    },
                  },
                );
              }}
            />
          </div>

          <div className="flex items-center gap-4 whitespace-nowrap">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {isSaving ? (
                <div className="h-2 w-2 bg-yellow rounded-full" />
              ) : (
                <div className="h-2 w-2 bg-green rounded-full" />
              )}
              {Date.now() - new Date(template.updatedAt).getTime() < 60_000
                ? "agora mesmo"
                : `há ${formatDistanceToNow(template.updatedAt)}`}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-gray-50">
          <Editor
            showBlockPalette
            showPropertiesPanel
            header={
              <EmailHeaderBar
                subject={{
                  value: subject,
                  onChange: (v) => {
                    setSubject(v);
                    if (!v || v === template.subject) return;
                    updateTemplateMutation.mutate(
                      { templateId: template.id, subject: v },
                      {
                        onError: (e) => {
                          toast.error(`${e.message}. Revertendo alterações.`);
                          setSubject(template.subject);
                        },
                      },
                    );
                  },
                }}
              />
            }
            initialContent={json}
            onUpdate={(content) => {
              setJson(content.getJSON());
              setIsSaving(true);
              deboucedUpdateTemplate();
            }}
            variables={["email", "firstName", "lastName"]}
            uploadImage={
              template.imageUploadSupported ? handleFileChange : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
