"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";
import { Input } from "@usesend/ui/src/input";
import { Button } from "@usesend/ui/src/button";
import { ChevronDown } from "lucide-react";
import { api } from "~/trpc/react";
import Link from "next/link";
import {
  ContactEvents,
  DomainEvents,
  EmailEvents,
  InboundEmailEvents,
  SendingEvents,
  WebhookEvents,
  isInboundWebhookEvent,
  type WebhookEventType,
} from "@usesend/lib/src/webhook/webhook-events";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@usesend/ui/src/dropdown-menu";
import { toast } from "@usesend/ui/src/toaster";
import type { Webhook } from "@prisma/client";

const EVENT_TYPES_ENUM = z.enum(WebhookEvents);

const editWebhookSchema = z.object({
  url: z
    .string({ required_error: "A URL é obrigatória" })
    .url("Digite uma URL válida"),
  eventTypes: z.array(EVENT_TYPES_ENUM, {
    required_error: "Selecione ao menos um evento",
  }),
  domainIds: z.array(z.number().int().positive()),
});

type EditWebhookFormValues = z.infer<typeof editWebhookSchema>;

const eventGroups: {
  label: string;
  events: readonly WebhookEventType[];
  requiresReceiving?: boolean;
}[] = [
  { label: "Eventos de contato", events: ContactEvents },
  { label: "Eventos de domínio", events: DomainEvents },
  { label: "Eventos de e-mail", events: EmailEvents },
  {
    label: "Recebimento de e-mail",
    events: InboundEmailEvents,
    requiresReceiving: true,
  },
];

export function EditWebhookDialog({
  webhook,
  open,
  onOpenChange,
}: {
  webhook: Webhook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateWebhook = api.webhook.update.useMutation();
  const domainsQuery = api.domain.domains.useQuery();
  const utils = api.useUtils();
  const initialHasAllEvents =
    (webhook.eventTypes as WebhookEventType[]).length === 0;
  const [allEventsSelected, setAllEventsSelected] =
    useState(initialHasAllEvents);

  const receivingDomains =
    domainsQuery.data?.filter((domain) => domain.receivingEnabled) ?? [];
  const hasReceiving = receivingDomains.length > 0;
  const inboundBlocked =
    domainsQuery.isLoading || domainsQuery.isError || !hasReceiving;
  const inboundBlockedMessage = domainsQuery.isLoading
    ? "Carregando domínios…"
    : domainsQuery.isError
      ? "Não foi possível verificar seus domínios."
      : "Nenhum domínio com recebimento ativo.";
  // Grandfathering: webhook que já tinha email.received salvo pode mantê-lo
  // (e desmarcá-lo), mesmo sem domínio receptor — só re-marcar exige receptor.
  const initialHasInbound = (webhook.eventTypes as string[]).some((event) =>
    isInboundWebhookEvent(event),
  );

  const form = useForm<EditWebhookFormValues>({
    resolver: zodResolver(editWebhookSchema),
    defaultValues: {
      url: webhook.url,
      eventTypes: initialHasAllEvents
        ? []
        : (webhook.eventTypes as WebhookEventType[]),
      domainIds: webhook.domainIds ?? [],
    },
  });

  useEffect(() => {
    if (open) {
      const hasAllEvents =
        (webhook.eventTypes as WebhookEventType[]).length === 0;
      form.reset({
        url: webhook.url,
        eventTypes: hasAllEvents
          ? []
          : (webhook.eventTypes as WebhookEventType[]),
        domainIds: webhook.domainIds ?? [],
      });
      setAllEventsSelected(hasAllEvents);
    }
  }, [open, webhook, form]);

  function handleSubmit(values: EditWebhookFormValues) {
    const selectedEvents = values.eventTypes ?? [];

    if (!allEventsSelected && selectedEvents.length === 0) {
      toast.error("Selecione ao menos um evento ou todos os eventos");
      return;
    }

    const wantsInbound = selectedEvents.some((event) =>
      isInboundWebhookEvent(event),
    );
    if (wantsInbound && !hasReceiving && !initialHasInbound) {
      toast.error(
        "Ative o recebimento em ao menos um domínio antes de assinar email.received",
      );
      return;
    }

    updateWebhook.mutate(
      {
        id: webhook.id,
        url: values.url,
        eventTypes: allEventsSelected ? [] : selectedEvents,
        domainIds: values.domainIds,
      },
      {
        onSuccess: async () => {
          await utils.webhook.list.invalidate();
          await utils.webhook.getById.invalidate({ id: webhook.id });
          toast.success("Webhook atualizado");
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar webhook</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="url"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>URL do endpoint</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/webhooks/madmail"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventTypes"
                render={({ field, formState }) => {
                  const selectedEvents = field.value ?? [];
                  const totalEvents = WebhookEvents;

                  const selectedCount = allEventsSelected
                    ? totalEvents.length
                    : selectedEvents.length;

                  const allSelectedLabel =
                    selectedCount === 0
                      ? "Selecione os eventos"
                      : allEventsSelected
                        ? "Todos os eventos"
                        : selectedCount === 1
                          ? selectedEvents[0]
                          : `${selectedCount} eventos selecionados`;

                  const isGroupFullySelected = (group: {
                    events: readonly WebhookEventType[];
                    requiresReceiving?: boolean;
                  }) => {
                    if (allEventsSelected) return !group.requiresReceiving;
                    if (selectedEvents.length === 0) return false;
                    return group.events.every((event) =>
                      selectedEvents.includes(event),
                    );
                  };

                  const handleToggleAll = (checked: boolean) => {
                    if (checked) {
                      setAllEventsSelected(true);
                      field.onChange([]);
                    } else {
                      setAllEventsSelected(false);
                      field.onChange([]);
                    }
                  };

                  const handleToggleGroup = (
                    groupEvents: readonly WebhookEventType[],
                  ) => {
                    if (allEventsSelected) {
                      // Descer de "todos": base = eventos de envio; inbound e
                      // webhook.test nunca entram implicitamente.
                      const next = SendingEvents.filter(
                        (event) => !groupEvents.includes(event),
                      );
                      setAllEventsSelected(false);
                      field.onChange(next);
                      return;
                    }

                    const current = new Set(selectedEvents);
                    const fullySelected = groupEvents.every((event) =>
                      current.has(event),
                    );

                    if (fullySelected) {
                      groupEvents.forEach((event) => current.delete(event));
                    } else {
                      groupEvents.forEach((event) => current.add(event));
                    }

                    field.onChange(Array.from(current));
                  };

                  const handleToggleEvent = (event: WebhookEventType) => {
                    if (allEventsSelected) {
                      const next = isInboundWebhookEvent(event)
                        ? [...SendingEvents, event]
                        : SendingEvents.filter((e) => e !== event);
                      setAllEventsSelected(false);
                      field.onChange(next);
                      return;
                    }

                    const exists = selectedEvents.includes(event);
                    const next = exists
                      ? selectedEvents.filter((e) => e !== event)
                      : [...selectedEvents, event];
                    field.onChange(next);
                  };

                  return (
                    <FormItem>
                      <FormLabel>Eventos</FormLabel>
                      <FormControl>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-3 inline-flex w-full items-center justify-between"
                            >
                              <span className="truncate text-left text-sm">
                                {allSelectedLabel}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="h-[30vh] w-[var(--radix-dropdown-menu-trigger-width)]">
                            <div className="space-y-3">
                              <DropdownMenuCheckboxItem
                                checked={allEventsSelected}
                                onCheckedChange={(checked) =>
                                  handleToggleAll(Boolean(checked))
                                }
                                onSelect={(event) => event.preventDefault()}
                                className="font-medium mb-2 px-2"
                              >
                                Todos os eventos
                              </DropdownMenuCheckboxItem>
                              {eventGroups.map((group) => {
                                const groupBlocked = Boolean(
                                  group.requiresReceiving && inboundBlocked,
                                );
                                return (
                                  <div key={group.label} className="">
                                    <DropdownMenuCheckboxItem
                                      checked={isGroupFullySelected(group)}
                                      disabled={groupBlocked}
                                      onCheckedChange={() =>
                                        handleToggleGroup(group.events)
                                      }
                                      onSelect={(event) =>
                                        event.preventDefault()
                                      }
                                      className="px-2 text-xs font-semibold text-muted-foreground"
                                    >
                                      {group.label}
                                    </DropdownMenuCheckboxItem>
                                    {group.events.map((event) => {
                                      const checked =
                                        selectedEvents.includes(event) ||
                                        (allEventsSelected &&
                                          !isInboundWebhookEvent(event));
                                      // Grandfathering: bloqueado só impede
                                      // MARCAR — desmarcar continua livre.
                                      const itemDisabled =
                                        groupBlocked && !checked;
                                      return (
                                        <DropdownMenuCheckboxItem
                                          key={event}
                                          checked={checked}
                                          disabled={itemDisabled}
                                          onCheckedChange={() =>
                                            handleToggleEvent(event)
                                          }
                                          onSelect={(event) =>
                                            event.preventDefault()
                                          }
                                          className="pl-3 pr-2 font-mono"
                                        >
                                          {event}
                                        </DropdownMenuCheckboxItem>
                                      );
                                    })}
                                    {groupBlocked ? (
                                      <p className="px-3 py-1 text-xs text-muted-foreground">
                                        {inboundBlockedMessage}{" "}
                                        {domainsQuery.isError ? (
                                          <button
                                            type="button"
                                            className="underline underline-offset-2"
                                            onClick={() =>
                                              domainsQuery.refetch()
                                            }
                                          >
                                            Tentar novamente
                                          </button>
                                        ) : !domainsQuery.isLoading &&
                                          initialHasInbound ? (
                                          <span>
                                            O evento continuará salvo, mas não
                                            será disparado até você reativar o
                                            recebimento.
                                          </span>
                                        ) : !domainsQuery.isLoading ? (
                                          <span>
                                            Ative o recebimento em um domínio
                                            para assinar este evento.
                                          </span>
                                        ) : null}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </FormControl>
                      <FormDescription>
                        {"“Todos os eventos” não inclui "}
                        <span className="font-mono">email.received</span>
                        {" — selecione-o explicitamente."}
                        {!domainsQuery.isLoading &&
                        !domainsQuery.isError &&
                        !hasReceiving ? (
                          <>
                            {" "}
                            <Link
                              href="/domains"
                              className="underline underline-offset-2"
                            >
                              Ativar recebimento em Domínios
                            </Link>
                          </>
                        ) : null}
                      </FormDescription>
                      {formState.errors.eventTypes ? <FormMessage /> : null}
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="domainIds"
                render={({ field }) => {
                  const selectedDomainIds = field.value ?? [];
                  const selectedDomains =
                    domainsQuery.data?.filter((domain) =>
                      selectedDomainIds.includes(domain.id),
                    ) ?? [];

                  const selectedDomainsLabel =
                    selectedDomainIds.length === 0
                      ? "Todos os domínios"
                      : selectedDomainIds.length === 1
                        ? (selectedDomains[0]?.name ?? "1 domínio selecionado")
                        : `${selectedDomainIds.length} domínios selecionados`;

                  const handleToggleDomain = (domainId: number) => {
                    const exists = selectedDomainIds.includes(domainId);
                    const next = exists
                      ? selectedDomainIds.filter((id) => id !== domainId)
                      : [...selectedDomainIds, domainId];
                    field.onChange(next);
                  };

                  return (
                    <FormItem>
                      <FormLabel>Domínios</FormLabel>
                      <FormControl>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-3 inline-flex w-full items-center justify-between"
                            >
                              <span className="truncate text-left text-sm">
                                {selectedDomainsLabel}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="max-h-[30vh] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
                            <div className="space-y-3">
                              <DropdownMenuCheckboxItem
                                checked={selectedDomainIds.length === 0}
                                onCheckedChange={() => field.onChange([])}
                                onSelect={(event) => event.preventDefault()}
                                className="mb-2 px-2 font-medium"
                              >
                                Todos os domínios
                              </DropdownMenuCheckboxItem>
                              {domainsQuery.data?.map((domain) => (
                                <DropdownMenuCheckboxItem
                                  key={domain.id}
                                  checked={selectedDomainIds.includes(
                                    domain.id,
                                  )}
                                  onCheckedChange={() =>
                                    handleToggleDomain(domain.id)
                                  }
                                  onSelect={(event) => event.preventDefault()}
                                  className="pl-3 pr-2"
                                >
                                  {domain.name}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </FormControl>
                      <FormDescription>
                        Deixe em todos os domínios para receber eventos de todos
                        os domínios.
                      </FormDescription>
                    </FormItem>
                  );
                }}
              />
              <div className="flex justify-end">
                <Button
                  className="w-[120px]"
                  type="submit"
                  disabled={updateWebhook.isPending}
                >
                  {updateWebhook.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
