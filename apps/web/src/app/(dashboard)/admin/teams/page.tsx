"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@usesend/ui/src/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";
import { Input } from "@usesend/ui/src/input";
import { Switch } from "@usesend/ui/src/switch";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
import { Badge } from "@usesend/ui/src/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { formatDistanceToNow } from "date-fns";

import { api } from "~/trpc/react";
import type { AppRouter } from "~/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";
import { isCloud } from "~/utils/common";

const searchSchema = z.object({
  query: z
    .string({ required_error: "Informe o ID do time, nome, domínio, e-mail de membro ou ID de assinatura" })
    .trim()
    .min(1, "Informe o ID do time, nome, domínio, e-mail de membro ou ID de assinatura"),
});

type SearchInput = z.infer<typeof searchSchema>;

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TeamAdmin = NonNullable<RouterOutputs["admin"]["findTeam"]>;

const updateSchema = z.object({
  apiRateLimit: z.coerce.number().int().min(1).max(10_000),
  dailyEmailLimit: z.coerce.number().int().min(0).max(10_000_000),
  isBlocked: z.boolean(),
  plan: z.enum(["FREE", "BASIC"]),
});

type UpdateInput = z.infer<typeof updateSchema>;

export default function AdminTeamsPage() {
  const [team, setTeam] = useState<TeamAdmin | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchForm = useForm<SearchInput>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: "" },
  });

  const updateForm = useForm<UpdateInput>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      apiRateLimit: 1,
      dailyEmailLimit: 0,
      isBlocked: false,
      plan: "FREE",
    },
  });

  useEffect(() => {
    if (team) {
      updateForm.reset({
        apiRateLimit: team.apiRateLimit,
        dailyEmailLimit: team.dailyEmailLimit,
        isBlocked: team.isBlocked,
        plan: team.plan,
      });
    }
  }, [team, updateForm]);

  if (!isCloud()) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
        As ferramentas de administração de times estão disponíveis apenas na implantação em nuvem.
      </div>
    );
  }

  const teamsQuery = api.admin.listTeams.useQuery();

  const findTeam = api.admin.findTeam.useMutation({
    onSuccess: (data) => {
      setHasSearched(true);
      if (!data) {
        setTeam(null);
        toast.info("Nenhum time encontrado para essa busca");
        return;
      }
      setTeam(data);
    },
    onError: (error) => {
      toast.error(error.message ?? "Não foi possível buscar o time");
    },
  });

  const updateTeam = api.admin.updateTeamSettings.useMutation({
    onSuccess: (updated) => {
      setTeam(updated);
      updateForm.reset({
        apiRateLimit: updated.apiRateLimit,
        dailyEmailLimit: updated.dailyEmailLimit,
        isBlocked: updated.isBlocked,
        plan: updated.plan,
      });
      toast.success("Configurações do time atualizadas");
    },
    onError: (error) => {
      toast.error(error.message ?? "Não foi possível atualizar as configurações do time");
    },
  });

  const onSearchSubmit = (values: SearchInput) => {
    setTeam(null);
    setHasSearched(false);
    findTeam.mutate(values);
  };

  const onUpdateSubmit = (values: UpdateInput) => {
    if (!team) return;
    updateTeam.mutate({ teamId: team.id, ...values });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg border p-6 shadow-sm">
        <Form {...searchForm}>
          <form
            onSubmit={searchForm.handleSubmit(onSearchSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={searchForm.control}
              name="query"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buscar time</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ID do time, nome do time, domínio, e-mail de membro ou ID de assinatura"
                      autoComplete="off"
                      {...field}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={findTeam.isPending}>
              {findTeam.isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" /> Buscando...
                </>
              ) : (
                "Buscar time"
              )}
            </Button>
          </form>
        </Form>
      </div>

      {findTeam.isPending ? null : hasSearched && !team ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Nenhum time corresponde a essa busca. Tente outra pesquisa.
        </div>
      ) : null}

      {/* Lista de todos os times */}
      <div className="rounded-lg border shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="font-medium">Todos os clientes</h3>
            <p className="text-xs text-muted-foreground">
              {teamsQuery.data?.length ?? 0} cliente(s). Clique em uma linha para
              gerenciar.
            </p>
          </div>
          {teamsQuery.isFetching ? (
            <Spinner className="h-4 w-4" />
          ) : null}
        </div>
        {teamsQuery.data && teamsQuery.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Domínios</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamsQuery.data.map((t) => (
                <TableRow
                  key={t.id}
                  className={`cursor-pointer ${
                    team?.id === t.id ? "bg-muted/50" : ""
                  }`}
                  onClick={() => {
                    setHasSearched(false);
                    setTeam(t);
                  }}
                >
                  <TableCell className="text-muted-foreground">
                    #{t.id}
                  </TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.plan}</Badge>
                  </TableCell>
                  <TableCell>{t.teamUsers.length}</TableCell>
                  <TableCell>{t.domains.length}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(t.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isBlocked ? "destructive" : "outline"}>
                      {t.isBlocked ? "Bloqueado" : "Ativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`/api/admin/impersonate?teamId=${t.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
                    >
                      Entrar na conta
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : teamsQuery.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">
            Carregando times...
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            Nenhum time cadastrado ainda.
          </div>
        )}
      </div>

      {team ? (
        <div className="space-y-6 rounded-lg border p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="text-xl font-semibold">{team.name}</p>
              <p className="text-xs text-muted-foreground">
                ID #{team.id} • Criado {formatDistanceToNow(new Date(team.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Plano: {team.plan}</Badge>
              <Badge variant={team.isBlocked ? "destructive" : "outline"}>
                {team.isBlocked ? "Bloqueado" : "Ativo"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Membros</h3>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                {team.teamUsers.length ? (
                  team.teamUsers.map((member) => (
                    <div
                      key={member.user.id}
                      className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{member.user.name ?? member.user.email}</p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum membro encontrado.</p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Domínios</h3>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                {team.domains.length ? (
                  team.domains.map((domain) => (
                    <div
                      key={domain.id}
                      className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm"
                    >
                      <span>{domain.name}</span>
                      <Badge variant={domain.status === "SUCCESS" ? "outline" : "secondary"}>
                        {domain.status === "SUCCESS"
                          ? "Verificado"
                          : domain.status.toLowerCase()}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum domínio conectado.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/10 p-4">
            <p className="text-sm text-muted-foreground">
              Contato de cobrança: {team.billingEmail ?? "Não definido"}
            </p>
          </div>

          <div className="rounded-lg border p-6">
            <Form {...updateForm}>
              <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="grid gap-6 lg:grid-cols-2">
                <FormField
                  control={updateForm.control}
                  name="apiRateLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de taxa da API</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={10000}
                          {...field}
                          value={Number.isNaN(field.value) ? 1 : field.value}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value))
                          }
                          disabled={updateTeam.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="dailyEmailLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite diário de e-mails</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={10_000_000}
                          {...field}
                          value={Number.isNaN(field.value) ? 0 : field.value}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value))
                          }
                          disabled={updateTeam.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="plan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plano</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={updateTeam.isPending}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o plano" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FREE">Free</SelectItem>
                            <SelectItem value="BASIC">Basic</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="isBlocked"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bloqueado</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={updateTeam.isPending}
                          />
                          <span className="text-sm text-muted-foreground">
                            {field.value ? "Time está bloqueado" : "Time está ativo"}
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="lg:col-span-2 flex justify-end">
                  <Button type="submit" disabled={updateTeam.isPending}>
                    {updateTeam.isPending ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" /> Salvando...
                      </>
                    ) : (
                      "Atualizar time"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
