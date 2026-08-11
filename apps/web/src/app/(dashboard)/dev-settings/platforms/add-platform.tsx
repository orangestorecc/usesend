"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { toast } from "@usesend/ui/src/toaster";
import { Plus } from "lucide-react";
import { api } from "~/trpc/react";

const NEW_BOOK = "__new__";

export default function AddPlatform() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [bookChoice, setBookChoice] = useState<string>(NEW_BOOK);
  const [newBookName, setNewBookName] = useState("");
  const [interval, setInterval] = useState("15");
  const [subscribeMode, setSubscribeMode] = useState("newsletter");
  const [testResult, setTestResult] = useState<string | null>(null);

  const utils = api.useUtils();
  const booksQuery = api.platformIntegration.contactBooks.useQuery();
  const testMutation = api.platformIntegration.test.useMutation();
  const createMutation = api.platformIntegration.create.useMutation();

  function reset() {
    setName("");
    setBaseUrl("");
    setApiKey("");
    setBookChoice(NEW_BOOK);
    setNewBookName("");
    setInterval("15");
    setSubscribeMode("newsletter");
    setTestResult(null);
  }

  function handleTest() {
    setTestResult(null);
    testMutation.mutate(
      { baseUrl, apiKey },
      {
        onSuccess: (data) => {
          const emails = data.sample
            .map((s) => s.email)
            .filter(Boolean)
            .join(", ");
          setTestResult(
            `✅ Conexão ok — ${data.sampleCount} cliente(s) na amostra${
              emails ? `: ${emails}` : ""
            }`,
          );
        },
        onError: (e) => setTestResult(`❌ ${e.message}`),
      },
    );
  }

  function handleSave() {
    if (!name || !baseUrl || !apiKey) {
      toast.error("Preencha nome, URL e chave de API.");
      return;
    }
    createMutation.mutate(
      {
        name,
        baseUrl,
        apiKey,
        provider: "orangestore",
        intervalMinutes: Number(interval),
        subscribeMode: subscribeMode as "newsletter" | "all" | "none",
        contactBookId: bookChoice === NEW_BOOK ? undefined : bookChoice,
        newContactBookName: bookChoice === NEW_BOOK ? newBookName : undefined,
      },
      {
        onSuccess: () => {
          utils.platformIntegration.list.invalidate();
          toast.success("Integração criada. Carga inicial iniciada.");
          reset();
          setOpen(false);
        },
        onError: (e) => toast.error(e.message ?? "Falha ao criar integração"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar plataforma
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova plataforma — OrangeStore</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da integração</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Minha Loja"
            />
          </div>

          <div>
            <Label>URL completa da API</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://sualoja.api.orangestore.cc"
            />
          </div>

          <div>
            <Label>Chave de API (X-Oc-Merchant-Id)</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="sua chave"
            />
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!baseUrl || !apiKey || testMutation.isPending}
            >
              {testMutation.isPending ? "Testando..." : "Testar conexão"}
            </Button>
            {testResult ? (
              <p className="mt-2 text-xs text-muted-foreground">{testResult}</p>
            ) : null}
          </div>

          <div>
            <Label>Lista de contatos (destino)</Label>
            <Select value={bookChoice} onValueChange={setBookChoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_BOOK}>+ Criar nova lista</SelectItem>
                {booksQuery.data?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bookChoice === NEW_BOOK ? (
              <Input
                className="mt-2"
                value={newBookName}
                onChange={(e) => setNewBookName(e.target.value)}
                placeholder="Nome da nova lista (ex.: Clientes OrangeStore)"
              />
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sincronizar a cada</Label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Inscrição (consentimento)</Label>
              <Select value={subscribeMode} onValueChange={setSubscribeMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newsletter">
                    Respeitar Newsletter da loja
                  </SelectItem>
                  <SelectItem value="all">Todos como inscritos</SelectItem>
                  <SelectItem value="none">Todos como não inscritos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar integração"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
