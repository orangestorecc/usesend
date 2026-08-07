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
import { CheckIcon, ClipboardCopy, Plus } from "lucide-react";
import { toast } from "@usesend/ui/src/toaster";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@usesend/ui/src/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";

// URL pública do servidor MCP (produção)
const MCP_CONNECTOR_URL = "https://mcp.madmail.com.br/mcp";

const rwCaps = [
  { key: "contacts", label: "Contatos" },
  { key: "lists", label: "Listas" },
  { key: "templates", label: "Templates" },
  { key: "segments", label: "Segmentos" },
  { key: "campaigns", label: "Campanhas" },
] as const;

const schema = z.object({
  name: z.string().min(1, { message: "Nome é obrigatório" }),
  contacts: z.enum(["none", "read", "write"]),
  lists: z.enum(["none", "read", "write"]),
  templates: z.enum(["none", "read", "write"]),
  segments: z.enum(["none", "read", "write"]),
  campaigns: z.enum(["none", "read", "write"]),
  analytics: z.enum(["none", "read"]),
  send: z.enum(["on", "off"]),
});

type FormValues = z.infer<typeof schema>;

export default function AddMcpKey() {
  const [open, setOpen] = useState(false);
  const [mcpKey, setMcpKey] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const createMutation = api.mcp.createMcpKey.useMutation();
  const utils = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      contacts: "write",
      lists: "write",
      templates: "write",
      segments: "write",
      campaigns: "write",
      analytics: "read",
      send: "on",
    },
  });

  function handleSave(values: FormValues) {
    createMutation.mutate(
      {
        name: values.name,
        scopes: {
          contacts: values.contacts,
          lists: values.lists,
          templates: values.templates,
          segments: values.segments,
          campaigns: values.campaigns,
          analytics: values.analytics,
          send: values.send === "on",
        },
      },
      {
        onSuccess: (data) => {
          utils.mcp.invalidate();
          setMcpKey(data);
          form.reset();
        },
      }
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(mcpKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  function close() {
    setMcpKey("");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? setOpen(_open) : null)}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Nova integração MCP
        </Button>
      </DialogTrigger>
      {mcpKey ? (
        <DialogContent key={mcpKey}>
          <DialogHeader>
            <DialogTitle>Copie a chave do MCP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Guarde agora — ela só aparece uma vez.
          </p>
          <div className="py-2 bg-secondary rounded-lg px-4 flex items-center justify-between mt-2">
            <p className="text-sm break-all">{mcpKey}</p>
            <Button
              variant="ghost"
              className="hover:bg-transparent p-0 ml-2"
              onClick={handleCopy}
            >
              {isCopied ? (
                <CheckIcon className="h-4 w-4 text-green" />
              ) : (
                <ClipboardCopy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-4 text-sm">
            <p className="font-medium">Como conectar no ChatGPT/Claude:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
              <li>
                URL do connector: <code>{MCP_CONNECTOR_URL}</code>
              </li>
              <li>
                Header: <code>Authorization: Bearer {"<sua chave>"}</code>
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" onClick={close}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova integração MCP</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex.: DRESS & CO" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                {rwCaps.map((cap) => (
                  <FormField
                    key={cap.key}
                    control={form.control}
                    name={cap.key}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{cap.label}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            <SelectItem value="read">Leitura</SelectItem>
                            <SelectItem value="write">
                              Leitura + escrita
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                ))}

                <FormField
                  control={form.control}
                  name="analytics"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relatórios</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="read">Leitura</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="send"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Envio (disparar)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="on">Permitido</SelectItem>
                          <SelectItem value="off">Bloqueado</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      )}
    </Dialog>
  );
}
