"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { Button } from "@usesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";
import { Textarea } from "@usesend/ui/src/textarea";
import { toast } from "@usesend/ui/src/toaster";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { api } from "~/trpc/react";

const FeedbackSchema = z.object({
  message: z.string().trim().min(1, "O feedback é obrigatório").max(2000),
});

export function FeedbackDialog({ trigger }: { trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<z.infer<typeof FeedbackSchema>>({
    resolver: zodResolver(FeedbackSchema),
    defaultValues: {
      message: "",
    },
  });

  const feedbackMutation = api.feedback.send.useMutation({
    onSuccess: () => {
      setSent(true);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const messageValue = form.watch("message");
  const trimmedMessage = messageValue?.trim() ?? "";

  useEffect(() => {
    const platform = navigator.userAgent || navigator.platform || "unknown";
    setIsMac(/Mac|iPhone|iPod|iPad/i.test(platform));
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset();
      // Deixa a tela de agradecimento sair só depois do fecha, sem piscar.
      setTimeout(() => setSent(false), 200);
    }
  }

  function onSubmit(values: z.infer<typeof FeedbackSchema>) {
    feedbackMutation.mutate({ message: values.message.trim() });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const isSubmitShortcut =
      (event.metaKey || event.ctrlKey) && event.key === "Enter";

    if (feedbackMutation.isPending || !isSubmitShortcut) return;

    event.preventDefault();
    form.handleSubmit(onSubmit)();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M20 6 9 17l-5-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <DialogTitle>Obrigado pelo seu feedback!</DialogTitle>
              <DialogDescription className="mt-2">
                Recebemos sua mensagem e ela já está registrada. A gente lê
                tudo — se fizer sentido, voltamos a falar com você.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSent(false)}>
                Enviar outro
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            </div>
          </div>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>Enviar feedback</DialogTitle>
          <DialogDescription>
            Compartilhe ideias ou problemas. Sua mensagem vai direto para os
            nossos fundadores.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      minLength={1}
                      maxLength={2000}
                      onKeyDown={handleKeyDown}
                      placeholder="Conte-nos o que você está pensando"
                      className="min-h-[160px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={feedbackMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!trimmedMessage || feedbackMutation.isPending}
              >
                {feedbackMutation.isPending ? "Enviando..." : "Enviar feedback"}
                {!feedbackMutation.isPending ? (
                  <>
                    <span
                      className="ml-2 inline-flex items-center gap-1 text-xs opacity-85"
                      aria-hidden
                    >
                      <kbd className="inline-flex items-center justify-center rounded border border-input bg-muted/20 px-1 py-0.5 h-5 min-w-5 font-sans  leading-none h-5 uppercase">
                        {isMac ? "⌘" : "^"}
                      </kbd>
                      <kbd className="inline-flex items-center justify-center rounded border border-input bg-muted/20 px-1 py-0.5 pt-1 h-5 min-w-5 leading-none font-sans h-5 uppercase">
                        ↵
                      </kbd>
                    </span>
                    <span className="sr-only">
                      {isMac ? "Command" : "Control"} mais Enter
                    </span>
                  </>
                ) : null}
              </Button>
            </DialogFooter>
          </form>
        </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
