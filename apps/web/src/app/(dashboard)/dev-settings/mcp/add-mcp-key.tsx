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

// Mesma fonte da tela de conexão — em outro ambiente as duas precisam bater.
const MCP_CONNECTOR_URL =
  process.env.NEXT_PUBLIC_MCP_URL || "https://mcp.madmail.com.br/mcp";

const rwCaps = [
  { key: "contacts", label: "Contatos" },
  { key: "lists", label: "Listas" },
  { key: "templates", label: "Modelos de e-mail" },
  { key: "segments", label: "Grupos de clientes" },
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
  reputation: z.enum(["none", "read"]),
  send: z.enum(["on", "off"]),
});

type FormValues = z.infer<typeof schema>;

export default function AddMcpKey() {
  const [open, setOpen] = useState(false);
  const [mcpKey, setMcpKey] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [guardou, setGuardou] = useState(false);
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
      reputation: "read",
      // Envio desligado por padrão: é a única ação irreversível e que custa
      // dinheiro. Quem precisa, liga de propósito.
      send: "off",
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
          reputation: values.reputation,
          send: values.send === "on",
        },
      },
      {
        onSuccess: (data) => {
          utils.mcp.invalidate();
          setMcpKey(data);
          form.reset();
        },
        onError: (e) =>
          toast.error(
            e.message ?? "Não conseguimos criar a chave. Tente de novo.",
          ),
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
    setGuardou(false);
    setIsCopied(false);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => {
        // Enquanto a chave estiver na tela, fechar por Esc/clique fora é como
        // perder a chave: ela não aparece de novo.
        if (!_open && mcpKey && !guardou) return;
        if (!_open) return close();
        setOpen(_open);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Nova chave
        </Button>
      </DialogTrigger>
      {mcpKey ? (
        <DialogContent key={mcpKey}>
          <DialogHeader>
            <DialogTitle>Guarde esta chave agora</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ela aparece uma única vez. Se fechar sem copiar, vai precisar criar
            outra.
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
            <p className="font-medium">Onde usar (seção para quem programa):</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
              <li>
                Endereço do Madmail: <code>{MCP_CONNECTOR_URL}</code>
              </li>
              <li>
                Mande junto a linha{" "}
                <code>Authorization: Bearer {"<sua chave>"}</code>
              </li>
            </ul>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={guardou}
              onChange={(e) => setGuardou(e.target.checked)}
              className="h-4 w-4"
            />
            Copiei e guardei em lugar seguro
          </label>
          {guardou ? null : (
            <p className="text-xs text-muted-foreground">
              Marque a caixinha para fechar — a chave não aparece de novo.
            </p>
          )}
          <DialogFooter>
            <Button type="button" onClick={close} disabled={!guardou}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova chave</DialogTitle>
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
                            <SelectItem value="none">Não pode ver</SelectItem>
                            <SelectItem value="read">Só pode ver</SelectItem>
                            <SelectItem value="write">
                              Pode ver e mudar
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
                          <SelectItem value="none">Não pode ver</SelectItem>
                          <SelectItem value="read">Só pode ver</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reputation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saúde dos envios</FormLabel>
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
                          <SelectItem value="none">Não pode ver</SelectItem>
                          <SelectItem value="read">Só pode ver</SelectItem>
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
                      <FormLabel>Enviar e-mail de verdade</FormLabel>
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
                          <SelectItem value="off">
                            Não — só monta e agenda
                          </SelectItem>
                          <SelectItem value="on">
                            Sim — pode disparar sozinho
                          </SelectItem>
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
