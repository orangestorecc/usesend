"use client";

import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";

import { api } from "~/trpc/react";
import { useState } from "react";
import {
  CheckIcon,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { toast } from "@usesend/ui/src/toaster";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";

const apiKeySchema = z.object({
  name: z.string({ required_error: "O nome é obrigatório" }).min(1, {
    message: "O nome é obrigatório",
  }),
  domainId: z.string().optional(),
});

export default function AddApiKey() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");
  const createApiKeyMutation = api.apiKey.createToken.useMutation();
  const [isCopied, setIsCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const domainsQuery = api.domain.domains.useQuery();

  const utils = api.useUtils();

  const apiKeyForm = useForm<z.infer<typeof apiKeySchema>>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "",
      domainId: "all",
    },
  });

  function handleSave(values: z.infer<typeof apiKeySchema>) {
    createApiKeyMutation.mutate(
      {
        name: values.name,
        permission: "FULL",
        domainId:
          values.domainId === "all" ? undefined : Number(values.domainId),
      },
      {
        onSuccess: (data) => {
          utils.apiKey.invalidate();
          setApiKey(data);
          setApiKeyName(values.name);
          apiKeyForm.reset();
        },
      }
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  }

  function copyAndClose() {
    handleCopy();
    setApiKey("");
    setApiKeyName("");
    setOpen(false);
    setShowApiKey(false);
    toast.success("Chave de API copiada para a área de transferência");
  }

  function slugify(value: string) {
    return (
      value
        .normalize("NFD")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "chave-de-api"
    );
  }

  function download(extension: "md" | "json", content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(apiKeyName)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Arquivo .${extension} baixado`);
  }

  function downloadMarkdown() {
    const createdAt = new Date().toLocaleString("pt-BR");
    download(
      "md",
      [
        `# Chave de API — ${apiKeyName}`,
        "",
        `- **Nome:** ${apiKeyName}`,
        `- **Criada em:** ${createdAt}`,
        "",
        "## Chave",
        "",
        "```",
        apiKey,
        "```",
        "",
        "> Guarde este arquivo em local seguro. Esta chave não pode ser exibida novamente.",
        "",
      ].join("\n"),
      "text/markdown;charset=utf-8"
    );
  }

  function downloadJson() {
    download(
      "json",
      JSON.stringify(
        {
          name: apiKeyName,
          apiKey,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "application/json;charset=utf-8"
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? setOpen(_open) : null)}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Criar chave de API
        </Button>
      </DialogTrigger>
      {apiKey ? (
        <DialogContent key={apiKey}>
          <DialogHeader>
            <DialogTitle>Copiar chave de API</DialogTitle>
          </DialogHeader>
          <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mt-2">
            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Esta é a única vez que a chave será exibida
              </p>
              <p className="text-sm text-muted-foreground">
                Guarde-a agora em um local seguro. Ao fechar esta janela não será
                possível visualizá-la novamente — se você perder a chave, será
                preciso criar uma nova.
              </p>
            </div>
          </div>
          <div className="py-1 bg-secondary rounded-lg px-4 flex items-center justify-between mt-2">
            <div>
              {showApiKey ? (
                <p className="text-sm">{apiKey}</p>
              ) : (
                <div className="flex gap-1">
                  {Array.from({ length: 40 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-1 h-1 bg-muted-foreground rounded-lg"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <Button
                variant="ghost"
                className="hover:bg-transparent p-0 cursor-pointer  group-hover:opacity-100"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                className="hover:bg-transparent p-0 cursor-pointer  group-hover:opacity-100"
                onClick={handleCopy}
              >
                {isCopied ? (
                  <CheckIcon className="h-4 w-4 text-green" />
                ) : (
                  <ClipboardCopy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Prefere guardar em arquivo? Baixe uma cópia:
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={downloadMarkdown}
              >
                <Download className="h-4 w-4" />
                Baixar .md
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={downloadJson}
              >
                <Download className="h-4 w-4" />
                Baixar .json
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={copyAndClose}
              disabled={createApiKeyMutation.isPending}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar uma nova chave de API</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Form {...apiKeyForm}>
              <form
                onSubmit={apiKeyForm.handleSubmit(handleSave)}
                className="space-y-8"
              >
                <FormField
                  control={apiKeyForm.control}
                  name="name"
                  render={({ field, formState }) => (
                    <FormItem>
                      <FormLabel>Nome da chave de API</FormLabel>
                      <FormControl>
                        <Input placeholder="chave de produção" {...field} />
                      </FormControl>
                      {formState.errors.name ? (
                        <FormMessage />
                      ) : (
                        <FormDescription>
                          Use um nome para identificar facilmente esta chave de
                          API.
                        </FormDescription>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={apiKeyForm.control}
                  name="domainId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Acesso a domínios</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o acesso a domínios" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">Todos os domínios</SelectItem>
                          {domainsQuery.data?.map(
                            (domain: { id: number; name: string }) => (
                              <SelectItem
                                key={domain.id}
                                value={domain.id.toString()}
                              >
                                {domain.name}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Escolha de qual domínio esta chave de API pode enviar
                        e-mails.
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button
                    className="w-[100px]"
                    type="submit"
                    disabled={createApiKeyMutation.isPending}
                  >
                    {createApiKeyMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
